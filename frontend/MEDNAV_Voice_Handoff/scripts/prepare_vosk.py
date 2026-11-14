#!/usr/bin/env python3
"""One-time download/repack of the official Apache-2.0 Vosk small English model.
Requires internet only during setup. The resulting .tar.gz is served locally.
Run from project root: python scripts/prepare_vosk.py
"""
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.request import urlretrieve
from zipfile import ZipFile
import tarfile

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'public'/'models'/'vosk-model.tar.gz'
URL='https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip'

def main():
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    if OUTPUT.exists() and OUTPUT.stat().st_size>1_000_000:
        print(f'Model exists: {OUTPUT}');return
    with TemporaryDirectory() as temp:
        directory=Path(temp)
        target=directory/'model.zip'
        print('Downloading official Vosk English model (~40 MB)...')
        urlretrieve(URL,target)
        print('Extracting...')
        with ZipFile(target) as archive:
            for member in archive.infolist():
                resolved=(directory/'extract'/member.filename).resolve()
                if not resolved.is_relative_to((directory/'extract').resolve()):
                    raise ValueError('Unexpected path in source archive')
            archive.extractall(directory/'extract')
        folders=list((directory/'extract').iterdir())
        if len(folders)!=1 or not folders[0].is_dir():raise ValueError('Unexpected Vosk archive structure')
        source=folders[0]
        if not (source/'am'/'final.mdl').exists():raise ValueError('Acoustic model missing')
        print('Creating browser-compatible tar.gz with top-level model/ folder...')
        with tarfile.open(OUTPUT,'w:gz') as output:
            output.add(source,arcname='model')
        print(f'Done: {OUTPUT} ({OUTPUT.stat().st_size/1_000_000:.1f} MB)')
        print('Vosk model license: Apache-2.0. See https://alphacephei.com/vosk/models')

if __name__=='__main__':main()
