import {error,fail} from '@sveltejs/kit';
import {readUsers,changeUser,usersWritable} from '$lib/server/users';
import type {Actions,PageServerLoad} from './$types';
export const load:PageServerLoad=async()=>({users:(await readUsers()).users.map(({username,created})=>({username,created})),writable:usersWritable()});
export const actions:Actions={default:async({locals,request,url})=>{
 if(locals.user?.role!=='admin'||request.headers.get('origin')!==url.origin)error(403);
 const form=await request.formData();
 try{await changeUser(String(form.get('action')),String(form.get('username')??'').trim(),String(form.get('password')??''));return {saved:true,message:'Vartotojų duomenys išsaugoti.'};}
 catch(cause){return fail(400,{saved:false,message:cause instanceof Error&& !cause.name.startsWith('Blob')?cause.message:'Nepavyko išsaugoti. Atnaujinkite puslapį ir bandykite dar kartą.'});}
}};
