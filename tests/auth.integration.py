# Run: python tests/auth.integration.py (uses isolated local accounts and storage).
import os,subprocess,tempfile,time,atexit,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
temporary=tempfile.TemporaryDirectory()
environment={**os.environ,'LED_ADMIN_SESSION_SECRET':'test-only-session-secret-32-characters','LED_ADMIN1_PASSWORD':'a1','LED_ADMIN2_PASSWORD':'a2','LED_USERS_DEV_FILE':temporary.name+'/users.json'}
environment.pop('BLOB_READ_WRITE_TOKEN',None)
environment['LED_CATALOG_DEV_FILE']=temporary.name+'/catalog.json'
server=subprocess.Popen(['npm','run','dev','--','--host','127.0.0.1','--port','5178','--strictPort'],cwd=root,env=environment,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,start_new_session=True)
import signal
def cleanup():
 os.killpg(server.pid,signal.SIGTERM)
 temporary.cleanup()
atexit.register(cleanup)
time.sleep(2)
import urllib.request,urllib.parse,urllib.error,http.cookiejar
class Response:
 def __init__(self,r):self.status_code=r.code;self.headers=r.headers;self.text=r.read().decode()
class Session:
 def __init__(self):
  class NoRedirect(urllib.request.HTTPRedirectHandler):
   def redirect_request(self,*args,**kwargs):return None
  self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()),NoRedirect())
 def call(self,url,data=None,headers={}):
  try:r=self.opener.open(urllib.request.Request(url,data=data if isinstance(data,bytes) else urllib.parse.urlencode(data).encode() if data is not None else None,headers=headers))
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
# Same-origin form submissions must retain Origin in real browsers.
page=get(a,'/admin/vartotojai',200)
assert page.headers.get('Referrer-Policy')=='same-origin'
# Keep refusing cross-origin and null-origin POSTs rather than bypassing CSRF.
for origin in ['https://untrusted.example','null']:
 response=a.post(b+'/admin/vartotojai',data={'action':'reveal','username':'admin1'},headers={'Origin':origin,'Accept':'text/html'})
 assert response.status_code==403

post(a,'/admin/vartotojai',{'action':'create','username':'uu','password':'12'},200)
# Secrets are only returned by an explicit administrator POST, not initial page data.
assert 'encryptedPassword' not in get(a,'/admin/vartotojai',200).text
r=post(a,'/admin/vartotojai',{'action':'reveal','username':'uu'},200)
assert 'value="12"' in r.text
r=post(a,'/admin/vartotojai',{'action':'reveal','username':'admin1'},200)
assert 'value="a1"' in r.text
post(u,'/login',{'username':'uu','password':'12'},303)
post(u,'/admin/vartotojai',{'action':'reveal','username':'admin1'},403)
post(u,'/admin/vartotojai',{'action':'reveal','username':'uu'},403)
get(u,'/',200);get(u,'/admin',403);get(u,'/admin/naudojimas',403);get(u,'/admin/vartotojai',403)
post(u,'/admin?/equipment',{'sling3':'9'},403)
# Shared device templates are visible to planners and writable by administrators.
path='/api/device-library'
def library(session):
 return json.loads(get(session,path,200).text)
def write_library(session,action,revision,device,code,origin=b):
 response=session.post(b+path,data=json.dumps({'action':action,'revision':revision,'device':device,'id':device['id']}).encode(),
  headers={'Origin':origin,'Content-Type':'application/json'})
 assert response.status_code==code,(code,response.status_code,response.text)
 return json.loads(response.text)
seed=library(u)
assert len(seed['devices'])==4
device={'id':'new','model':'Bandymo procesorius','ports':[{'id':'in','name':'HDMI IN','direction':'in','signal':'HDMI'}]}
write_library(u,'add',seed['revision'],device,403)
write_library(a,'add',seed['revision'],device,403,'https://untrusted.example')
write_library(a,'add',seed['revision'],{**device,'ports':[device['ports'][0]]*2},400)
added=write_library(a,'add',seed['revision'],device,200)
stored=next(d for d in library(u)['devices'] if d['model']==device['model'])
assert stored['id']!='new'
write_library(a,'update',seed['revision'],stored,409)
updated=write_library(a,'update',added['revision'],{**stored,'model':'Patikslintas modelis'},200)
assert any(d['model']=='Patikslintas modelis' for d in library(u)['devices'])
write_library(a,'remove',updated['revision'],stored,200)
assert all(d['id']!=stored['id'] for d in library(u)['devices'])
print('PASS: shared device library seed, cross-user visibility, permissions, validation, conflict, update and removal')
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
