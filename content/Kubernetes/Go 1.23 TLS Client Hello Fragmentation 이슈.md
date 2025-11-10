
## Intro

AWS 환경에서 EKS 노드가 조인에 실패하는 문제가 이썽ㅆ다. 네트워크 설정에 문제가 없는데, packet retransmission이 지속적으로 발생하고 timedout이 발생했다.
근본 원인은 네트워크 장비에서 IP Fragmentation을 재조립하지 못해서 발생하는 이슈였다. 이는 golang 버전 업그레이드로 인한것이었다.


## Troubleshooting
go 1.23에서는 tls 기본 key exchange 알고리즘을 `X25519Kyber768Draft00` 으로 변경했다. [1]

해당 X25519Kyber768Draft00의 문서에 대한 설명을 보면 public key 값과 ephemeral까지 합해서 1216 byte임을 확인할 수 있다.

>For the client's share, the key_exchange value contains the
   concatenation of the client's X25519 ephemeral share (32 bytes) and
   the client's Kyber768Draft00 public key (1184 bytes).  The resulting
   key_exchange value is 1216 bytes in length.
   > — [RFC / Kyber768 Draft 문서](#)


wireshark로 보면 Client Hello 길이가 1543으로 일반적으로 3~400바이트인 것에 반해 매우 큰것을 볼 수 있다.
![[kyber.png]]

정상인 경우 아래와 같이 400 바이트정도 밖에 안된다.
![[no-kyber.png]]

이로 인해 네트워크 장비에서 패킷을 재조립하지 못하고 drop 해버려 응답을 받지못해 계속해서 재전송되며 timedout이 발생해버렸다.

EKS에서는 nodeadm으로 node를 클러스터에 조인시키는데, 해당 도구가 golang으로 작성되어있었고 1.23으로 업그레이드 되어 발생하는 문제였다.

[1] https://github.com/golang/go/issues/67061
