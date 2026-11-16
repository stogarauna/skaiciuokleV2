# Run: python tests/auth.integration.py (uses isolated local accounts and storage).
import os,subprocess,tempfile,time,atexit
from pathlib import Path
root=Path(__file__).resolve().parents[1]
temporary=tempfile.TemporaryDirectory()
environment={**os.environ,'LED_ADMIN_SESSION_SECRET':'test-only-session-secret-32-characters','LED_ADMIN1_PASSWORD':'a1','LED_ADMIN2_PASSWORD':'a2','LED_USERS_DEV_FILE':temporary.name+'/users.json'}
environment.pop('BLOB_READ_WRITE_TOKEN',None)
server=subprocess.Popen(['npm','run','dev','--','--host','127.0.0.1','--port','5178','--strictPort'],cwd=root,env=environment,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
import signal
def cleanup():
 os.killpg(server.pid,signal.SIGTERM)
 temporary.cleanup()
atexit.register(cleanup)
time.sleep(2)
import urllib.request,urllib.parse,urllib.error,http.cookiejar
class Response:
 def __init__(self,r):self.status_code=r.code;self.text=r.read().decode()
class Session:
 def __init__(self):
  class NoRedirect(urllib.request.HTTPRedirectHandler):
   def redirect_request(self,*args,**kwargs):return None
  self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()),NoRedirect())
 def call(self,url,data=None,headers={}):
  try:r=self.opener.open(urllib.request.Request(url,data=urllib.parse.urlencode(data).encode() if data is not None else None,headers=headers))
  except urllib.error.HTTPError as e:r=e
  return Response(r)
 def get(self,url,**kw):return self.call(url)
 def post(self,url,data,headers,**kw):return self.call(url,data,headers)
class requests:Session=Session
b='http://127.0.0.1:5178'
a=requests.Session();u=requests.Session()
def get(s,path,code):
 r=s.get(b+path,allow_redirects=False);assert r.status_code==code,(path,r.status_code,r.text[:200]);return r
def post(s,path,data,code):
 r=s.post(b+path,data=data,headers={'Origin':b,'Accept':'text/html'},allow_redirects=False);assert r.status_code==code,(path,r.status_code,r.text[:300]);return r
get(u,'/',303);get(u,'/admin',303);get(u,'/api/usage',401)
post(a,'/login',{'username':'admin1','password':'a1'},303)
get(a,'/',200);get(a,'/admin',200)
post(a,'/admin/vartotojai',{'action':'create','username':'uu','password':'12'},200)
post(u,'/login',{'username':'uu','password':'12'},303)
get(u,'/',200);get(u,'/admin',403);get(u,'/admin/naudojimas',403);get(u,'/admin/vartotojai',403)
post(u,'/admin?/equipment',{'sling3':'9'},403)
post(a,'/admin/vartotojai',{'action':'password','username':'uu','password':'34'},200)
get(u,'/',303)
post(u,'/login',{'username':'uu','password':'12'},401)
post(u,'/login',{'username':'uu','password':'34'},303)
post(a,'/admin/vartotojai',{'action':'delete','username':'uu'},200)
get(u,'/',303)
post(a,'/logout',{},303);get(a,'/',303)
post(a,'/login',{'username':'admin','password':'admin'},401)
post(a,'/login',{'username':'admin2','password':'a2'},303);get(a,'/admin/vartotojai',200)
print('PASS: login, short passwords, both administrators, user CRUD, session revocation, admin/API restrictions, logout, old admin disabled')
