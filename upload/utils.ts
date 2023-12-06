import AdmZip from 'adm-zip';
import * as https from 'https';

export function getZipData(binaryData: Buffer): [string, string, string] | null {
    let zipEntries;
    let zip;
    try {
        zip = new AdmZip(binaryData);
        zipEntries = zip.getEntries();
    } catch (e) {
        console.error(e);
        return null;
    }

    if (zipEntries.length > 0) {
        let repository = '';
        let name = '';
        let version = '';

        // get zip file name
        const zip_name = zipEntries[0].entryName.split('/')[0];
        console.log('zip_name', zip_name);

        zipEntries.forEach((zipEntry) => {
            if (zipEntry.entryName === `${zip_name}/package.json`) {
                const data = JSON.parse(zipEntry.getData().toString('utf8'));
                name = data.name;
                repository = data.repository as string;
                version = data.version;
            }
        });

        name = name.replace('/', '');
        return [name, repository, version];
    } else {
        console.log('no zip file found');
        return null;
    }
}

// broken, need a reliable source to find zips of the packages
export function getZipFromUrl(owner: string, name: string): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        https
            .get(`https://api.github.com/repos/${owner}/${name}/tarball/master`, (response) => {
                console.log(`https://api.github.com/repos/${owner}/${name}/tarball/master`);
                console.log('response', response.statusMessage);
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
