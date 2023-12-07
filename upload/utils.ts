import AdmZip from 'adm-zip';
import { OutgoingHttpHeaders } from 'http2';
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
        version = version.replace('v', '');
        console.log('version', version);
        return [name, repository, version];
    } else {
        console.log('no zip file found');
        return null;
    }
}

export function fixGhUrl(url: string): string {
    if (!url.includes('https://github.com')) {
        if (url.includes('github.com')) {
            return `https://${url}`;
        } else {
            return `https://github.com/${url}`;
        }
    } else {
        return url;
    }
}

// broken, need a reliable source to find zips of the packages
export function getZipFromUrl(owner: string, name: string): Promise<Buffer> {
    const headersDict = {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'request',
    };

    const requestOptions = {
        headers: headersDict as OutgoingHttpHeaders,
    };

    const url =
        fixGhUrl(`${owner}/${name}`).replace('https://github.com', 'https://codeload.github.com') +
        '/legacy.zip/refs/heads/master';

    return new Promise<Buffer>((resolve, reject) => {
        https
            .get(url, requestOptions, (response) => {
                console.log('response', response.statusCode);
                console.log('url', url);

                if (response.statusCode !== 200) {
                    reject(new Error('Failed to download file from url'));
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
