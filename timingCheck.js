const { chromium } = require("playwright");
const fs = require("fs");
//const csvHeader = "url,load_time\n";


const REPORTS = [
  {
    url: "https://stage.firstdue.com/report/result/51761",
    username: "seattleFDAdmin@firstduesizeup.com",
    password: "sizeup1234"
  },
  {
    url: "https://stage.firstdue.com/report/result/59881",
    username: "seattleFDAdmin@firstduesizeup.com",
    password: "sizeup1234"
  }
];


//formatter function
function formatTime(ms) {
  if (ms < 1000) {
    return `${ms.toFixed(1)} ms`;   // under 1s → show in ms
  } else {
    return `${(ms / 1000).toFixed(2)} s`;  // 1s or more → show in seconds
  }
}


(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const results = [];

  for (const report of REPORTS) {
    const context = await browser.newContext();
    const page = await context.newPage();

    // 🔗 Create CDP session
    const client = await context.newCDPSession(page);
    await client.send("Network.enable");

    console.log(`🔑 Logging in for report: ${report.url}`);
    await page.goto("https://stage.firstdue.com/auth/signin-v2");

    // login
    await page.fill("input[id='email']", report.username);
    await page.click("button[title='Continue']");
    await page.fill("input[id='password']", report.password);
    await page.click("button[title='Sign in']");

    // ✅ Wait for redirect after login
    await page.waitForURL("**/responderV2/**", { timeout: 20000 });

    console.log(`📊 Opening: ${report.url}`);

    let capturedTiming = null;

    client.on("Network.responseReceived", async (event) => {
      if (event.response.url.includes("getResultList")) {
        capturedTiming = event.response.timing; // DevTools timings
      }
    });

    await page.goto(report.url);

    // wait a bit to let response come in
    await page.waitForTimeout(3000);

    let totalTime = "N/A";
   if (capturedTiming) {
  const rawMs = capturedTiming.receiveHeadersEnd; // DevTools timing in ms
  totalTime = formatTime(rawMs);
  console.log(`✅ ${report.url} => ${totalTime}`);
}
    else {
      console.log(`⚠️ No getResultList timing captured for ${report.url}`);
    }

    results.push({ url: report.url, load_time: totalTime });
    await context.close();
  }

  await browser.close();

  // Save results
  const csvHeader = "url,load_time\n";
 // const csvHeader = "url,load_time(ms)\n";
  const csvRows = results.map(r => `${r.url},${r.load_time}`).join("\n");
  fs.writeFileSync(
    `report_timings_${new Date().toISOString().split("T")[0]}.csv`,
    csvHeader + csvRows
  );
  console.log("📁 Saved timings to CSV");
})();
