import {canWriteCatalog,readCatalog} from '$lib/server/catalog';
import {sharedDevices} from '$lib/device-library';
import {usageEnabled,usagePreference} from '$lib/server/usage';
import type {PageServerLoad} from './$types';

export const load: PageServerLoad = async ({cookies,fetch,setHeaders,locals}) => {
 setHeaders({'cache-control':'no-store'});
 const {catalog,revision}=await readCatalog(fetch);
 return {cargo:catalog.cargo??[],panels:catalog.panels,equipmentWeights:catalog.equipmentWeights,deviceLibrary:{folders:catalog.rentmanFolders,devices:sharedDevices(catalog.signalDevices,catalog.wireflowPresetsInstalled),revision,writable:canWriteCatalog()},user:locals.user!, usage:usageEnabled()?usagePreference(cookies):null};
};
