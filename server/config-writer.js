import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { projectCardSettings } from './card-config.js';
export async function writeCardSettings(configPath,cardSettings){const target=resolve(configPath),projected=projectCardSettings(cardSettings),output={...projected.serviceConfig,location:projected.location};await mkdir(dirname(target),{recursive:true});const temporary=`${target}.${process.pid}.${Date.now()}.tmp`;await writeFile(temporary,`${JSON.stringify(output,null,2)}\n`,{mode:0o600});await rename(temporary,target);return output;}
