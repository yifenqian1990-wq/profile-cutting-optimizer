fetch("https://ais-dev-nibvgmy43qthhoi3vozbyl-427851304919.asia-east1.run.app/api/auth/verify", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ deviceId: "DEV-E8EAE875" })
}).then(async res => {
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
}).catch(console.error);
