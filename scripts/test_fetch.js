const url = 'https://jqpyqqlkgisykgywilrf.supabase.co/rest/v1/exercise_catalog?id=eq.86';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpxcHlxcWxrZ2lzeWtneXdpbHJmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNjcyNjMsImV4cCI6MjA4Njg0MzI2M30.HGvZZHYwAj1whHcUDIMu0fwdI9Xzngvl_VXaDs2S0ZU';

async function testFetch() {
    console.log('Testing PATCH via fetch...');
    const res = await fetch(url, {
        method: 'PATCH',
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({
            image_url: '/exercises/futures_abdomen_crunch_declinado_final.png'
        })
    });
    
    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Body:', text);
}

testFetch();
