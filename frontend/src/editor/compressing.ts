import LZString from 'lz-string';

export function Compress(AppState : object){
    const data : string = JSON.stringify(AppState);
    console.log(AppState);
    window.location.hash =  LZString.compressToEncodedURIComponent(data);
    copyUrlToClipboard(window.location.href);

}

export function Decrompress(){
    const url : URL = new URL (window.location.href);
    const hash = url.hash.substring(1);
    if(hash.length <= 1) return;
    return JSON.parse(LZString.decompressFromEncodedURIComponent(hash));
}

function copyUrlToClipboard(url : string) {
    navigator.clipboard.writeText(url)
        .then(() => {
            console.log('URL copied to clipboard successfully!');
        })
        .catch(err => {
            console.error('Failed to copy URL: ', err);
        });
}