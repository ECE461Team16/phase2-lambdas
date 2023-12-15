/**
 * Represents package metadata
 */

export interface Package {
    name: string;
    version: string;
    repository: string;
    readme: string;
    binaryData: Buffer;
    ratings: string;
}
