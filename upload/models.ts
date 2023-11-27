/**
 * Represents package metadata
 */

export interface Package {
    name: string;
    version: string;
    repository: string;
    binaryData: Buffer;
}
