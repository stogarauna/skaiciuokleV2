import {canWriteCatalog,readCatalog} from '$lib/server/catalog';
import {sharedDevices} from '$lib/device-library';
import {usageEnabled,usagePreference} from '$lib/server/usage';
import type {PageServerLoad} from './$types';

export const load: PageServerLoad = async ({cookies,fetch,setHeaders,locals}) => {
 setHeaders({'cache-control':'no-store'});
 const {catalog,revision}=await readCatalog(fetch);
 return {panels:catalog.panels,equipmentWeights:catalog.equipmentWeights,deviceLibrary:{devices:sharedDevices(catalog.signalDevices),revision,writable:canWriteCatalog()},user:locals.user!, usage:usageEnabled()?usagePreference(cookies):null};
};
