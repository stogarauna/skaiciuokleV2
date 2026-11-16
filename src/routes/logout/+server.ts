import {error,redirect} from '@sveltejs/kit';
import {signOut} from '$lib/server/admin-auth';
import type {RequestHandler} from './$types';
export const POST:RequestHandler=({cookies,request,url})=>{if(request.headers.get('origin')!==url.origin)error(403);signOut(cookies);redirect(303,'/login');};
