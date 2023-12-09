import AdmZip from 'adm-zip';
import { OutgoingHttpHeaders } from 'http2';
import { https } from 'follow-redirects';

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
                repository = data.repository; // TODO: resolve different repository formats to the github url
                version = data.version;
            }
        });

        console.log(repository);
        if (name === undefined || version === undefined || repository === undefined) {
            name = '';
            version = '';
            repository = '';
        } else {
            name = name.replace('/', '');
            version = version.replace('v', '');
            repository =
                typeof repository === 'object' ? (repository = (repository as { url: string }).url) : repository;
            repository = repository.toString().replace('git+', '').replace('.git', '').replace('git://', 'https://');
        }
        return [name, repository, version];
    } else {
        console.log('no zip file found');
        return null;
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

    const url = `https://api.github.com/repos/${owner}/${name}/zipball/HEAD`;

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

export function isJSON(str: string) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}
