const axios = require("axios");
const xml2js = require("xml2js");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const jalaali = require("jalaali-js");

// just node
const dataFile = path.join(__dirname, "khabaronline_all.json");
const checkpointFile = path.join(__dirname, "checkpoint.json");

// docker
// const dataFile = path.join(__dirname, "data", "khabaronline_all.json");
// const checkpointFile = path.join(__dirname, "data", "checkpoint.json");



// live checking id to prevent duplicate
let allData = {};
const existingIds = new Set();
const savePath = path.join(__dirname, `khabaronline_all.json`);

if (fs.existsSync(savePath)) {
  const fileData = JSON.parse(fs.readFileSync(savePath));
  allData = fileData;

  for (const year in fileData) {
    for (const month in fileData[year]) {
      for (const day in fileData[year][month]) {
        const articles = fileData[year][month][day];
        articles.forEach((article) => {
          if (article.id) {
            existingIds.add(article.id);
          }
        });
      }
    }
  }
}

// --------- UTILS ---------
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(min = 200, max = 400) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function safeRequest(url, options = {}) {
  try {
    const response = await axios.get(url, options);
    await sleep(randomDelay());
    return response;
  } catch (err) {
    if (err.response?.status === 429) {
      console.warn(`🚫 429 Too Many Requests. Waiting 30 minutes...`);
      await sleep(30 * 60 * 1000); // 30 minutes
      return safeRequest(url, options);
    } else {
      throw err;
    }
  }
}

// --------- FETCH SITEMAP ---------
async function fetchSitemapLinks(jy, jm, jd) {
  const year = jy.toString();
  const month = jm.toString().padStart(2, "0");
  const day = jd.toString().padStart(2, "0");
  const sitemapUrl = `https://www.khabaronline.ir/sitemap/${year}/${month}/${day}/sitemap.xml`;

  try {
    const response = await safeRequest(sitemapUrl, { responseType: "text" });
    const contentType = response.headers["content-type"];
    const links = [];

    if (contentType.includes("application/json")) {
      const jsonData = JSON.parse(response.data);
      if (Array.isArray(jsonData.urls)) {
        jsonData.urls.forEach((urlObj) => {
          if (urlObj.loc) links.push(urlObj.loc);
        });
      }
    } else {
      const parser = new xml2js.Parser({ explicitArray: false });
      const result = await parser.parseStringPromise(response.data);
      const urls = result.urlset?.url;
      if (Array.isArray(urls)) {
        urls.forEach((url) => {
          if (url.loc) links.push(url.loc);
        });
      } else if (urls?.loc) {
        links.push(urls.loc);
      }
    }

    return links;
  } catch (err) {
    console.error(`❌ Failed to fetch sitemap: ${sitemapUrl} -`, err.message);
    return [];
  }
}

// --------- PARSE ARTICLE ---------
async function parseArticle(url) {
  try {
    const response = await safeRequest(url);
    const $ = cheerio.load(response.data);

    const title = $("h1").text().trim();
    const content = $('div[itemprop="articleBody"]').text().trim();
    const dateText = $("li.date").text().trim();
    const topicText = $('meta[property="article:section"]').attr("content");
    const publisher = $('meta[property="article:publisher"]').attr("content");

    // Parse date
    let year = "",
      month = "",
      day = "",
      time = "";
    if (dateText.includes("-")) {
      const [datePart, timePart] = dateText.split(" - ");
      const parts = datePart.trim().split(" ");
      if (parts.length === 3) {
        [day, month, year] = parts;
      }
      time = timePart.trim();
    }

    // Parse topic
    let maintopic = "",
      childnews = "";
    if (topicText?.includes(">")) {
      [maintopic, childnews] = topicText.split(">").map((t) => t.trim());
    } else {
      maintopic = topicText;
    }

    const images = [];
    $('div[itemprop="articleBody"] img, div.item-summary img').each(
      (_, img) => {
        const src = $(img).attr("src");
        if (src && !images.includes(src)) {
          images.push(src);
        }
      }
    );

    const id = url.split("/")[4];

    return {
      id,
      url,
      title,
      content,
      date: { year, month, day, time },
      topic: { maintopic, childnews },
      publisher,
      images,
    };
  } catch (error) {
    console.error(`❌ Error parsing ${url}:`, error.message);
    return null;
  }
}


// --------- SAVE CHECKPOINT ---------
function saveCheckpoint(jy, jm, jd) {
  fs.writeFileSync(checkpointFile, JSON.stringify({ jy, jm, jd }), "utf-8");
}

function loadCheckpoint() {
  if (fs.existsSync(checkpointFile)) {
    return JSON.parse(fs.readFileSync(checkpointFile, "utf-8"));
  }
  return { jy: 1388, jm: 2, jd: 31 }; // Start from this if no checkpoint
}

// --------- NEXT JALAALI DAY ----------
function getNextJalaaliDay(jy, jm, jd) {
  const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd);
  const date = new Date(gy, gm - 1, gd); // JS month is 0-indexed
  date.setDate(date.getDate() + 1); // Add 1 day
  const {
    jy: nextJy,
    jm: nextJm,
    jd: nextJd,
  } = jalaali.toJalaali(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  );
  return { jy: nextJy, jm: nextJm, jd: nextJd };
}

// --------- MAIN ---------
(async () => {
  const endDate = { jy: 1403, jm: 3, jd: 1 }; // Customize
  let { jy, jm, jd } = loadCheckpoint();

  while (true) {
    const dateStr = `${jy}-${jm.toString().padStart(2, "0")}-${jd
      .toString()
      .padStart(2, "0")}`;
    console.log(`📅 Processing: ${dateStr}`);

    const links = await fetchSitemapLinks(jy, jm, jd);
    console.log(`🔗 Found ${links.length} links`);

    for (const link of links) {
      const article = await parseArticle(link);
      if (article && !existingIds.has(article.id)) {
        if (!allData[jy]) allData[jy] = {};
        if (!allData[jy][jm]) allData[jy][jm] = {};
        if (!allData[jy][jm][jd]) allData[jy][jm][jd] = [];
    
        allData[jy][jm][jd].push(article);
        existingIds.add(article.id);
        console.log(`✅ Added article: ${article.id}`);
      } else if (article) {
        console.log(`⚠️ Skipped duplicate article: ${article.id}`);
      }
    }
    // After processing all articles for the day
    fs.writeFileSync(dataFile, JSON.stringify(allData, null, 2));
    console.log(`📝 Checkpoint saved: ${jy}-${jm}-${jd}`);
    

    saveCheckpoint(jy, jm, jd);
    console.log(`📝 Checkpoint saved: ${dateStr}`);

    if (jy === endDate.jy && jm === endDate.jm && jd === endDate.jd) break;

    // Next Jalaali day
    const next = getNextJalaaliDay(jy, jm, jd);
    jy = next.jy;
    jm = next.jm;
    jd = next.jd;
  }

  console.log("✅ All done!");
})();
