import AdmZip from 'adm-zip';
import * as https from 'https';

export function getZipData(binaryData: Buffer): [string, string, string] | null {
    let zipEntries;
    try {
        const zip = new AdmZip(binaryData);
        zipEntries = zip.getEntries();
    } catch (e) {
        console.error(e);
        return null;
    }

    if (zipEntries.length > 0) {
        let repository = '';
        let name = '';
        let version = '';

        zipEntries.forEach((zipEntry) => {
            if (zipEntry.entryName === `smallest-master/package.json`) {
                const data = JSON.parse(zipEntry.getData().toString('utf8'));
                name = data.name;
                repository = data.repository;
                version = data.version;
            }
        });

        name = name.replace('/', '');
        repository = 'https://github.com/' + repository;
        return [name, repository, version];
    } else {
        console.log('no zip file found');
        return null;
    }
}

// broken, need a reliable source to find zips of the packages
export function getZipFromUrl(url: string): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        https
            .get(url.replace('https://', 'https://codeload.') + '/archive/refs/heads/master.zip', (response) => {
                console.log(url.replace('https://', 'https://codeload.') + '/archive/refs/heads/master.zip');
                console.log('response', response.statusCode);
                // console.log('response', response);
                if (response.statusCode !== 200) {
                    reject(new Error('Filed to download file from url'));
                    return;
                }

                const chunks: Buffer[] = [];

                response.on('data', (chunk: Buffer) => {
                    chunks.push(chunk);
                });

                response.on('end', () => {
                    const fileBuffer = Buffer.concat(chunks);
                    resolve(fileBuffer);
                });
            })
            .on('error', (error) => {
                reject(error);
            });
    });
}
