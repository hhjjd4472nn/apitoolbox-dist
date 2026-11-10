import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {dataRoot} from './state.mjs';

const ALGORITHM='aes-256-gcm';
export class SecretStore {
  constructor(file=path.join(dataRoot(),'secrets.bin'),osCredential=null){this.file=file;this.osCredential=osCredential;}
  _ready(){if(!this.osCredential||typeof this.osCredential.encrypt!=='function'||typeof this.osCredential.decrypt!=='function'||!this.osCredential.available?.())throw new Error('OS credential encryption unavailable');}
  _wrapKey(){this._ready();if(!fs.existsSync(this.file))return null;const envelope=JSON.parse(fs.readFileSync(this.file,'utf8'));if(envelope.version!==2)throw new Error('Secret store version unsupported');return envelope;}
  _decryptEnvelope(envelope){this._ready();const raw=Buffer.from(envelope.wrappedKey,'base64');const key=Buffer.from(this.osCredential.decrypt(raw));if(key.length!==32)throw new Error('OS credential key invalid');return key;}
  read(){
    if(!fs.existsSync(this.file))return {};
    const envelope=this._wrapKey();const key=this._decryptEnvelope(envelope);const decipher=crypto.createDecipheriv(ALGORITHM,key,Buffer.from(envelope.iv,'base64'));decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));const plain=Buffer.concat([decipher.update(Buffer.from(envelope.data,'base64')),decipher.final()]).toString('utf8');return JSON.parse(plain);
  }
  write(value){
    this._ready();let envelope=fs.existsSync(this.file)?this._wrapKey():null;const key=envelope?this._decryptEnvelope(envelope):crypto.randomBytes(32);const iv=crypto.randomBytes(12);const cipher=crypto.createCipheriv(ALGORITHM,key,iv);const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);const wrapped=Buffer.from(this.osCredential.encrypt(key));if(wrapped.length<16)throw new Error("OS credential wrapping failed");
    envelope={version:2,wrappedKey:wrapped.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')};fs.mkdirSync(path.dirname(this.file),{recursive:true});const tmp=`${this.file}.tmp-${process.pid}`;fs.writeFileSync(tmp,JSON.stringify(envelope),{mode:0o600});fs.renameSync(tmp,this.file);
  }
  get(ref){return this.read()[ref]||null;}
  set(ref,value){const all=this.read();all[ref]=value;this.write(all);return ref;}
  remove(ref){const all=this.read();delete all[ref];this.write(all);}
}