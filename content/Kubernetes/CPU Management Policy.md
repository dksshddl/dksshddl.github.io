
## Intro

몇몇 고성능을 요구하는 워크로드에서 CPU Management policy를 필요하는 경우가있다.

기본적으로 kubernetes는 CFS quota를 사용해서 task에 할당되는 cpu 코어는 계속 바뀐다. [1] 이떄 context switching과 cache flush등 발생하겠지만... 대부분의 경우 ms정도 소요되어서 큰 문제는 없을거다. 

> 갑자기 레전드 제프딘 선생님이 공유해주신 [Latency numbers every programmer should know](https://gist.github.com/hellerbarde/2843375#latency-numbers-every-programmer-should-know)가 떠올랐다..


4CPU 가진 인스턴스에서 Pod를 띄우고 한번 테스트 해보자.

htop으로 CPU 사용량을 보면 아래와 같이 CPU core를 골고루 사용하는 것을 볼 수 있다.

![[none-cpu.gif]]

한편 kubelet에 ```--cpu-manager-policy``` 를 static으로 주면 아래와 같이 1개의 core만 사용되는 것을 볼 수 있다.

![[static-cpu.gif]]


## 사용방법

조건은 다음과 같다.
1. kubelet cpu reserved 설정 추가 [1]

왜 static CPU management에 cpu reserved 설정이 추가해야하는지 약간 의아했는데, [1] 문서의 다음 코멘트와 코드내 주석[2] 을 통해 안정성을 위해서인 것을 확인했다.

>The kubelet requires a CPU reservation greater than zero be made using either `--kube-reserved` and/or `--system-reserved` or `--reserved-cpus` when the static policy is enabled. This is because zero CPU reservation would allow the shared pool to become empty.

코드내 주석에도 다음과 같이 cpu reservation이 없는 경우 shared pool이 CPU 고갈되어 Pod가 evict되는것을 방지한다고 되어있다.

>The static policy requires this to be nonzero. Zero CPU reservation
   would allow the shared pool to be completely exhausted. At that point either we would violate our guarantee of exclusivity or need to evict any pod that has at least one container that requires zero CPUs. See the comments in policy_static.go for more details.

2. kubelet ```--cpu-manager-policy=static```옵션 추가
3. Pod의 QoS class가 ```Guaranteed``` 에서 정수로 ```CPU``` reqeusts로 설정

>[!info]
 Guaranteed Pod는 requests와 limits 를 동일하게 설정하면 생성할 수 있다. [2] Node는 리소스가 부족해지면 BestEffort > Burstable > Guaranteed 순서로 Pod를 evict 시킨다.

### 살펴보기
내부 구현으로 CPU를 할당하는 과정은 ```policy_static.go```[3] 함수에서 확인할 수 있었다.
그 중 가장 중요한 로직 takeByTopology 함수에서 확인할 수 있따.

CPU 선택시 NUMA 노드에 분산[4]할것이냐, 몰아서[5] 선택할 것이냐인지 확인한다.


```go
# policy_static.go
func (p *staticPolicy) takeByTopology(logger logr.Logger, availableCPUs cpuset.CPUSet, numCPUs int) (cpuset.CPUSet, error) {
	cpuSortingStrategy := CPUSortingStrategyPacked
	if p.options.DistributeCPUsAcrossCores {
		cpuSortingStrategy = CPUSortingStrategySpread
	}

	if p.options.DistributeCPUsAcrossNUMA {
		cpuGroupSize := 1
		if p.options.FullPhysicalCPUsOnly {
			cpuGroupSize = p.cpuGroupSize
		}
		return takeByTopologyNUMADistributed(logger, p.topology, availableCPUs, numCPUs, cpuGroupSize, cpuSortingStrategy)
	}

	return takeByTopologyNUMAPacked(logger, p.topology, availableCPUs, numCPUs, cpuSortingStrategy, p.options.PreferAlignByUncoreCacheOption)
}

```

이 떄 [4], [5] 알고리즘을 보면 알고리즘에 대한 주석이 매우 길다.
실제로 해당 설정이 추가된 배경은 [6] 문서에서 좀 더 확인이 가능했다.

기본적으로 CPUManager 는 CPU를 NUMA node가 꽉찰떄까지 몰아서 배치했다. 이렇게되면 CPU가 한개의 NUMA node에서 몰려서 사용이되어서, 최소 1개의 NUMA node에서는 사용 가능한 CPU가 부족해지고, 이러한 NUMA에서 돌아가는 task는 작업시간이 길어지게 될 수 있다.

그래서 단순히 static policy를 사용하는 것에 넘어서 인스턴스를 사용할 떄, 애플리케이션 사용 목적과 NUMA 구조를 사용하면서 병목현상이 있는지 등 점검하여 적절한 CPUManagerPolicyOptions 을 줄 수 있어야 겠다.

static policy에는 6가지 종류가 있고, 이름과 기능이 직관적이다. 자세한 설명은 [7]에서 확인이 가능한다.

>[!info]
full-pcpus-only, distribute-cpus-across-numa, align-by-socket, distribute-cpus-across-cores, strict-cpu-reservation, prefer-align-cpus-by-uncorecache



[1] https://kubernetes.io/docs/tasks/administer-cluster/cpu-management-policies/#static-policy-configuration

[2] https://kubernetes.io/docs/tasks/configure-pod-container/quality-service-pod/#create-a-pod-that-gets-assigned-a-qos-class-of-guaranteed

[3] https://github.com/kubernetes/kubernetes/blob/afb2b97425317948e9e59b2a7871fca5bbb2ab08/pkg/kubelet/cm/cpumanager/policy_static.go#L444-L480

[4] https://github.com/kubernetes/kubernetes/blob/afb2b97425317948e9e59b2a7871fca5bbb2ab08/pkg/kubelet/cm/cpumanager/cpu_assignment.go#L893

[5] https://github.com/kubernetes/kubernetes/blob/afb2b97425317948e9e59b2a7871fca5bbb2ab08/pkg/kubelet/cm/cpumanager/cpu_assignment.go#L776

[6] https://github.com/kubernetes/enhancements/tree/e7f51ffbe2ee398ffd1fba4a6d854f276bfad9fb/keps/sig-node/2902-cpumanager-distribute-cpus-policy-option

[7] https://kubernetes.io/docs/concepts/policy/node-resource-managers/#cpu-policy-static--options