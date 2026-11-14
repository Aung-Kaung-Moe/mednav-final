import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export default function setup() {
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
 for(const name of ['qa-evidence','.demo-runtime'])fs.mkdirSync(path.join(root,name),{recursive:true});
}
