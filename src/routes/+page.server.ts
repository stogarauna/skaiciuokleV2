import {readCatalog} from '$lib/server/catalog';
import {usageEnabled,usagePreference} from '$lib/server/usage';
import type {PageServerLoad} from './$types';

export const load: PageServerLoad = async ({cookies,fetch,setHeaders,locals}) => {
 setHeaders({'cache-control':'no-store'});
 const {catalog}=await readCatalog(fetch);
 return {...catalog,user:locals.user!, usage:usageEnabled()?usagePreference(cookies):null};
};
