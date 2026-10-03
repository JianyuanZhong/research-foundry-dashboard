"""Small-segment TCP transport for the fixed, host-key-verified Phai SSH endpoint."""
import os,select,socket,sys,time
s=socket.socket(socket.AF_INET,socket.SOCK_STREAM)
s.setsockopt(socket.IPPROTO_TCP,socket.TCP_MAXSEG,536)
s.setsockopt(socket.IPPROTO_TCP,socket.TCP_NODELAY,1)
s.settimeout(15);s.connect(('115.190.98.251',33388));s.settimeout(None)
while True:
 ready,_,_=select.select([s,0],[],[],30)
 for source in ready:
  data=s.recv(65536) if source is s else os.read(0,65536)
  if not data:sys.exit(0)
  if source is s:
   while data:n=os.write(1,data);data=data[n:]
  else:
   while data:s.sendall(data[:256]);data=data[256:];time.sleep(.002)
