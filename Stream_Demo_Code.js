// using a local json file to store my credentials and account identifier, feel free to change the code to allow environmental variables or whatever method you'd prefer
import credentialsJSON from "./credentials.json" assert {type: "json"};
import fetch from "node-fetch";

const auth_email = credentialsJSON.Cloudflare["X-Auth-Email"]
const auth_key = credentialsJSON.Cloudflare["X-Auth-Key"]
const account_identifier = credentialsJSON.Cloudflare["Account Identifier"]
const stream_endpoint = `https://api.cloudflare.com/client/v4/accounts/${account_identifier}/stream`
let allowed_origins = []
let new_details = {}
let videos

const headers = {
    'Content-Type': 'application/json',
    'X-Auth-Email': auth_email,
    'X-Auth-Key': auth_key
}

async function list_videos() {
    return await fetch(stream_endpoint, {
        headers: headers
    })
        .then(response => response.json())
        .then(response => response.result)
}
/*
videos = await list_videos()
console.log(videos)
console.log(`Videos in storage: ${videos.length}`)
*/

async function get_video_by_string(query_string) {
    return await fetch(`${stream_endpoint}?search=${query_string}`, {
        headers:headers
    })
        .then(response => response.json())
        .then(response => response.result)
}
/*
const keyword = 'demo'
videos = await get_video_by_string(keyword)
console.log(videos)
console.log(`Videos matching "${keyword}" keyword: ${videos.length}`)
*/

async function upload_from_URL(_video_name, _upload_url, require_signed_URLs=false, signed_URL_restrictions={}, _allowed_origins = []) {

    const video_details = {
        allowedOrigins: _allowed_origins,
        meta: {
            name: _video_name
        },
        url: _upload_url,
        requireSignedURLS: require_signed_URLs
    }

    const options = {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(video_details)
    }

    let upload_response = await fetch(`${stream_endpoint}/copy`, options).then(response => response.json())

    if (require_signed_URLs) {
        // fetches the token and puts it into the response
        upload_response.result['token'] = await fetch(`${stream_endpoint}/${upload_response.result.uid}/token`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(signed_URL_restrictions)
        }).then(response => response.json()).then(response => response.result.token)
    }

    return upload_response
}

/*
const upload_response = await upload_from_URL('Video 1', 'https://storage.googleapis.com/stream-example-bucket/video.mp4')
console.log(upload_response)
console.log(`Uploaded video called: ${upload_response.result.meta.name}. Link here: https://customer-l2xwcctust1kbhgy.cloudflarestream.com/${upload_response.result.uid}/watch`)
*/

async function delete_video(_video_identifier) {
    return (await fetch(`${stream_endpoint}/${_video_identifier}`, {
        method: 'DELETE',
        headers: headers
    })).status
}

async function edit_video(_video_identifier, _new_details) {

    return (await fetch(`${stream_endpoint}/${_video_identifier}`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(_new_details)
    })
        .then(response => response.json()).then(response => response.success)
    )
}

const video_details = {'Video 2': 'https://storage.googleapis.com/stream-example-bucket/video.mp4'}

const require_signed_URLs = true
const signed_URL_restrictions = {
    accessRules:[{"type":"ip.geoip.country","country":["PT"],"action":"allow"}]
}

async function bulk_upload() {
    let identifier
    for (const video_name in video_details) {
        const upload_response = await upload_from_URL(video_name, video_details[video_name], require_signed_URLs, signed_URL_restrictions)
        if (upload_response.success) {
            if (!require_signed_URLs) {
                identifier = upload_response.result.uid
            } else {
                identifier = upload_response.result.token
            }
            console.log(`Uploaded video called: ${video_name}. Link here: https://customer-l2xwcctust1kbhgy.cloudflarestream.com/${identifier}/watch`)
        } else {
            console.log(`Failed to upload video called: ${video_name}`)
        }
    }
    return identifier
}

//bulk_upload()

let max_date = new Date()
max_date.setDate(max_date.getDate() - 1)

allowed_origins = ['shelbe.cf', 'example.com']
new_details = {
    allowedOrigins: allowed_origins
}

async function bulk_edits(_new_details, _max_date) {
    const uploaded_videos = await list_videos()
    for (const entry of uploaded_videos) {
        const creation_date = Date.parse(entry.created)
        if (creation_date > _max_date) {
            const video_name = entry.meta.name
            if (await edit_video(entry.uid, _new_details)) {
                console.log(`Edited video called: ${video_name}`)
            } else {
                console.log(`Failed to edit video called: ${video_name}`)
            }
        }
    }
}

//bulk_edits(new_details, max_date)

async function bulk_delete(_max_date) {
    const uploaded_videos = await list_videos()
    for (const entry of uploaded_videos) {
        const creation_date = Date.parse(entry.created)
        if (creation_date > _max_date) {
            const video_name = entry.meta.name
            if (await delete_video(entry.uid)) {
                console.log(`Deleted video called: ${video_name}`)
            } else {
                console.log(`Failed to delete video called: ${video_name}`)
            }
        }
    }
}

//bulk_delete(max_date)