
console.log('Script started');
const https = require('https');
console.log('HTTPS module loaded');

const apiKey = 'AIzaSyAxCy2QhsxS1rLHeXPKe1b6iaMTq3UIRFM';

const configurations = [
    { version: 'v1beta', model: 'gemini-1.5-flash' },
    { version: 'v1beta', model: 'models/gemini-1.5-flash' },
    { version: 'v1', model: 'gemini-1.5-flash' },
    { version: 'v1', model: 'models/gemini-1.5-flash' },
    { version: 'v1beta', model: 'gemini-pro' },
    { version: 'v1', model: 'gemini-pro' }
];

async function testConfig(config) {
    console.log(`Testing ${config.version} / ${config.model}...`);
    
    // Ensure model has 'models/' prefix if not present? 
    // Actually the API expects 'models/{model}' in the URL path segment.
    // URL pattern: /v1beta/models/{model}:generateContent
    // So if config.model is 'gemini-1.5-flash', path is /v1beta/models/gemini-1.5-flash:generateContent
    // If config.model is 'models/gemini-1.5-flash', path is /v1beta/models/models/gemini-1.5-flash -> WRONG.
    
    // Wait, the documentation says: POST https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent
    // So "models/" is part of the URL structure, followed by the model name.
    
    let modelName = config.model;
    if (modelName.startsWith('models/')) {
        modelName = modelName.replace('models/', '');
    }
    
    const path = `/${config.version}/models/${modelName}:generateContent?key=${apiKey}`;
    console.log(`Path: ${path}`);
    
    const options = {
        hostname: 'generativelanguage.googleapis.com',
        path: path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    const body = JSON.stringify({
        contents: [{
            parts: [{ text: 'Hello' }]
        }]
    });

    return new Promise((resolve) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                console.log(`Response status: ${res.statusCode}`);
                resolve({
                    config,
                    status: res.statusCode,
                    response: data.substring(0, 200)
                });
            });
        });

        req.on('error', (e) => {
            console.log(`Request error: ${e.message}`);
            resolve({ config, status: 'Error', response: e.message });
        });

        req.write(body);
        req.end();
    });
}

async function runTests() {
    console.log('Running tests...');
    for (const config of configurations) {
        await testConfig(config);
    }
    console.log('All tests done');
}

runTests().catch(err => console.error('Fatal error:', err));
