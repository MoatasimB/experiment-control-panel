const targetAppUrl = process.env.TARGET_APP_URL || "http://127.0.0.1:4180";
const count = Number(process.argv[2] || 50);

const response = await fetch(`${targetAppUrl}/traffic`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ count })
});

if (!response.ok) {
  throw new Error(`Traffic generation failed with status ${response.status}`);
}

console.log(JSON.stringify(await response.json(), null, 2));
