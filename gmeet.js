const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const fs = require("fs");

const config = {
  name: "Gigalabs Assistant",
  fps: 30,
  width: 1920,
  height: 1080,
};

// Get google meet link and do not proceed if no argument is provided
const link = process.argv.slice(2);
if (!link.length) return;

const output = fs.createWriteStream(__dirname + "/final.mp4");

puppeteer
  .launch({
    args: ["--use-fake-ui-for-media-stream", "--kiosk"],
    ignoreDefaultArgs: ["--enable-automation"],
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: false,
  })
  .then(async browser => {
    const context = browser.defaultBrowserContext();
    await context.overridePermissions(link[0], ["notifications"]);

    const page = await browser.newPage();
    await page.goto(link[0]);

    await page.evaluate((config) => {
      let recorder;

      const target = document.querySelector("body");
      const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(async node => {
            if (node.tagName === "IFRAME") {
              const stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                  frameRate: config.fps,
                  width: config.width,
                  height: config.height,
                },
                audio: true,
              });

              recorder = new MediaRecorder(stream);

              recorder.ondataavailable = async (e) => {
                function arrayBuffer2String(r){let e=new Uint8Array(r),n=e.length,a="",l=255;for(let t=0;t<n;t+=l)t+l>n&&(l=n-t),a+=String.fromCharCode.apply(null,e.subarray(t,t+l));return a}
                const buffer = await e.data.arrayBuffer();
                const string = arrayBuffer2String(buffer);
                await window.initRecording(string);
              };

              recorder.onstop = async () =>
                setTimeout(async () => {
                  await window.endRecording();
                  stream.getTracks().forEach((track) => track.stop());
                }, 2000);

              recorder.start(3000);
            }
          });

          mutation.removedNodes.forEach(async node => {
            if (node.tagName === "AUDIO" && recorder && recorder.state !== "inactive") {
                recorder.stop();
            }
          });
        });
      });

      observer.observe(target, { childList: true });
    }, config);

    await page.exposeFunction("initRecording", async chunk => {
        const str2ab=e=>{let t=new ArrayBuffer(e.length),n=new Uint8Array(t);for(let r=0,l=e.length;r<l;r++)n[r]=e.charCodeAt(r);return t};

        const data = Buffer.from(str2ab(chunk));
        output.write(data);
    });

    await page.exposeFunction("endRecording", async () => {
      await output.close();
      await browser.close();
    });

    // Wait for the selector to appear and fill it
    await page.waitForSelector('[autocomplete="name"]');
    await page.type('[autocomplete="name"]', config.name);

    // Find the join button and click
    const button = await page.evaluateHandle(() => {
        const spans = document.querySelectorAll('span');
        const filtered = [...spans].filter(span => span.textContent.includes('Ask to join'));

        return filtered[0];
    });

    await button.click();
  });
