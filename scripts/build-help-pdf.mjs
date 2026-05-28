import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const mimeTypes = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".json": "application/json; charset=utf-8",
};

function safePathFromUrl(url) {
    const parsed = new URL(url, "http://127.0.0.1");
    const requestedPath = decodeURIComponent(parsed.pathname === "/" ? "/help-print.html" : parsed.pathname);
    const filePath = path.resolve(root, "." + requestedPath);

    if (!filePath.startsWith(root)) {
        throw new Error("Blocked path traversal attempt.");
    }

    return filePath;
}

const server = http.createServer(async (req, res) => {
    try {
        const filePath = safePathFromUrl(req.url || "/help-print.html");
        const data = await fs.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
        res.end(data);
    } catch (err) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
    }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const port = typeof address === "object" && address ? address.port : 0;

const browser = await puppeteer.launch({ headless: "new" });

try {
    const page = await browser.newPage();

    await page.goto(`http://127.0.0.1:${port}/help-print.html`, {
        waitUntil: "networkidle0",
    });

    await page.pdf({
        path: path.join(root, "app-explanation-v1.0.pdf"),
        format: "A4",
        printBackground: true,
        margin: {
            top: "14mm",
            right: "12mm",
            bottom: "14mm",
            left: "12mm",
        },
    });

    console.log("Built app-explanation-v1.0.pdf");
} finally {
    await browser.close();
    server.close();
}