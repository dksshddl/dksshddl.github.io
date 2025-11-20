
## Intro

v1002 릴리즈 부터 eks ami에서는 network interface를 처리하는 새로운 기능이 [1]에서 추가됐고, 해당 기능에 대해 자세히 살펴보았다.

## Deep dive

먼저 해당 기능이 추가된 이유에 대해서는 [1]에서 자세히 소개되어있다.  ```amazon-ec2-net-utils``` 과 nodeadm사이에 node bootstrap시 구성하는 Network 설정문제간 race condition이 있었다.

> the issue can only manifest when networking calls (eg. to `ec2.DescribeInstances`) are made before `nodeadm` has a chance to update `systemd-networkd` with a drop-in that forces the network config to match against primary ENI. [2]

[1]에 도입된 새로운 기능에 대해 자세히 살펴보면 다음과 같다.

먼저 udev 장치관리자를 통해 network interface 가 추가되면 ```udev-net-manager``` 서비스를 등록하도록 구성돼있다. [3]

network interface가 등록되면 udev-net-manager가 실행되고, manager(cni or systemd)를 확인한뒤 각 인터페이스에 적절하게 네트워크를 구성한다.

1. cloud-init의 종료를 기점으로, 종료전 추가된 interface에는 systemd에 관리되는것으로, 종료 이후에는 CNI에 의해 관리되는 것으로 network device에 마킹한다.

```go
func (b *fsBroker) determineManager(_ string) (string, error) {
	// this code checks whether cloud-init has finished booting the node, which
	// is indicative of most user-controlled actions being completed. it's not
	// perfect but it works under the basic assumptions.
	const cloudInitBootResultPath = "/run/cloud-init/result.json"
	if _, err := os.Stat(cloudInitBootResultPath); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return ManagerSystemd, nil
		}
		return "", err
	}
	return ManagerCNI, nil
}
```

2. systemd로 관리되는 것이면 CNI에 의해 routing이 구성되지 않도록 자체적으로 새롭게 구성한다.

```go
func (c *netManager) manageLink(ctx context.Context) error {
	deviceIndex, err := getDeviceIndex(ctx, c.imds, c.selfMac)
	if err != nil {
		return err
	}
	networkCard, err := getNetworkCard(ctx, c.imds, c.selfMac)
	if err != nil {
		return err
	}

	const (
		// see: https://github.com/amazonlinux/amazon-ec2-net-utils/blob/3261b3b4c8824343706ee54d4a6f5d05cd8a5979/lib/lib.sh#L39
		metricBase = 512
		// see: https://github.com/amazonlinux/amazon-ec2-net-utils/blob/3261b3b4c8824343706ee54d4a6f5d05cd8a5979/lib/lib.sh#L32
		ruleBase = 10000
	)

	templateVars := networkTemplateVars{
		MAC: c.selfMac,
		// setup route metics. this provides priority on good interfaces over
		// ones that could potentially delay startup.
		// see: https://github.com/amazonlinux/amazon-ec2-net-utils/blob/3261b3b4c8824343706ee54d4a6f5d05cd8a5979/lib/lib.sh#L348-L366
		Metric: metricBase + 100*networkCard + deviceIndex,
	}

	// we only need to add routes/rules to interfaces beyond the primary.
	// see: https://github.com/amazonlinux/amazon-ec2-net-utils/blob/main/lib/lib.sh#L570-L580
	if c.selfMac != c.primaryMac {
		// setup table id for use in defining default routes.
		// see: https://github.com/amazonlinux/amazon-ec2-net-utils/blob/3261b3b4c8824343706ee54d4a6f5d05cd8a5979/lib/lib.sh#L349
		templateVars.TableID = ruleBase + 100*networkCard + deviceIndex

		// getting the interface ip allows us to create a policy rule through
		// the gateway for the default route. we dont care about the error here,
		// because if we get a 404 then we assume this is an ipv6 network then
		// we wont setup the ip.
		//
		// TODO: no support for ipv6 today.
		if ipv4s, _ := c.imds.GetProperty(ctx, imds.LocalIPv4s(c.selfMac)); len(ipv4s) > 0 {
			// at the time we make this request, we expect no other ip addresses
			// besides the one assigned on attachment, but we can still split
			// this and take the first item since its not empty.
			ipv4 := strings.Split(ipv4s, "\n")[0]
			templateVars.InterfaceIP = strings.TrimSpace(ipv4)
		}
	}

	networkConfig, err := renderNetworkTemplate(templateVars)
	if err != nil {
		return fmt.Errorf("failed to render network template: %w", err)
	}

	return util.WriteFileWithDir(eksNetworkPath(c.iface), networkConfig, 0644)
}
```

> [!info] 
> 실제로는 systemd로 관리되는 경우 /run/systemd/network/70-eks-{iface}.network" 경로에 네트워크 설정파일을 생성한다. [4]


아래 명령어로 interface가 어떤 manager로 초기화 됐는지 로그를 볼 수 있고,
race condition이나 네트워크 구성 트러블슛팅할때 확인할 수 있다.

```log
# journalctl --unit=udev-net-manager@${interface}
```

아직 log collector에 해당 로그가 수집되지 않아서, 애를 먹었었다.. 그래서 [PR](https://github.com/awslabs/amazon-eks-ami/pull/2490) 올렸더니 lint 수정 후 바로 merge 됐다.


## Troubleshooting

여기서 문제가되는 부분은 바로 여기이다.

> cloud-init의 종료를 기점으로, 종료전 추가된 interface에는 systemd에 관리되는것으로, 종료 이후에는 CNI에 의해 관리되는 것으로 network device에 마킹한다.

cloud-init이 종료된 이후에 생성된 network interface에 대하여만, systemd에 의해 추가 라우팅을 구성해야하는데, cloud-init이 시작되며 nodeadm이 또한 시작되면 race condition이 발생할 수 있다.

CNI 입장에서야, network interface가 systemd/CNI에 의해 관리되는지 알 바가 아니지만 노드 레벨에서는 CNI가 관리하는 ENI와 systemd가 관리되는 경우 라우팅 규칙이 다를 수 있기 떄문에 다르게 관리 되어야한다.

만일, 아래 순서로 초기화된다면 문제가 된다.
1. cloud-init 도중 kubelet이 시작되고, CNI가 올라와 라우팅 규칙 설정
2. systemd가 다시 한번 라우팅 규칙 설정하여 CNI 규칙에 덮어씀
3. CNI는 정상적으로 라우팅 규칙을 설정한것으로 인지하고, IPAM에 따라 pod에 해당 Netowrk Interface에 IP 할당.

>[!info]
> systemd에 의해 관리되는 경우에 대하여 예를들면 노드에 `attach-network-interface`로 onprem 등 연결하기 위한 추가 ENI를 직접 붙이는 경우가 있겠다.

reference
[1] https://github.com/awslabs/amazon-eks-ami/pull/2419 

[2] https://github.com/awslabs/amazon-eks-ami/pull/2324

[3] https://github.com/awslabs/amazon-eks-ami/blob/4d7940832cf45bbc31ba7a74baa958e23d9c8e6a/templates/al2023/runtime/rootfs/etc/udev/rules.d/90-eks.rules#L9

[4] https://github.com/awslabs/amazon-eks-ami/blob/4d7940832cf45bbc31ba7a74baa958e23d9c8e6a/nodeadm/cmd/nodeadm-internal/udev/net_manager.go#L132