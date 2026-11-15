import {readCatalog} from '$lib/server/catalog';
import type {PageServerLoad} from './$types';

export const load: PageServerLoad = async ({fetch, setHeaders}) => {
 setHeaders({'cache-control':'no-store'});
 const {catalog}=await readCatalog(fetch);
 return catalog;
};
