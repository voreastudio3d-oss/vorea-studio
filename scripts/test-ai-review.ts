

async function main() {
  try {
    const loginRes = await fetch("http://localhost:3001/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "vorea.studio3d@gmail.com", password: "d3d05B3" })
    });
    const loginData = await loginRes.json();
    if (!loginData.token) {
      console.log("Login failed", loginData);
      return;
    }

    const token = loginData.token;
    console.log("Logged in!");

    const res = await fetch("http://localhost:3001/api/feedback/ai-review", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    console.log("Status:", res.status);
    console.log("Response:", await res.text());
  } catch (err) {
    console.error("Crash:", err);
  }
}

main();
