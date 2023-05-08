import axios from "axios";
import * as cheerio from "cheerio";
import { writeFileSync, readFileSync } from "fs";
import { stringify } from "csv-stringify";
import { v5 as uuidv5 } from "uuid";

const url = "https://adaycharter.com/";
const ABS = process.cwd();
const languages = ["en", "fr", "ru"];

async function getHtml(path) {
  const [folder, fileName] = path.split("/");
  let html = "";
  // check exist file in .cache folder
  try {
    html = await readFileSync(`${ABS}/cache/${fileName}`);
    console.log("File found in cache folder");
  } catch (error) {
    console.log("File not found in cache folder. Start save file to disk");
    try {
      const response = await axios.get(url + path);
      saveHtmlToDisk(fileName, response.data);
      html = response.data;
    } catch (error) {
      console.log("Error while get html from server");
      html = null;
    }
  } finally {
    return html;
  }
}

function saveHtmlToDisk(fileName, html) {
  writeFileSync(`${ABS}/cache/${fileName}`, html);
}

// const allLinks = [
//   "top-yacht/fjord-38-xspress.html",
//   "top-yacht/absolute-40.html",
//   "top-yacht/nissa.html",
//   "top-yacht/prestige-42-s.html",
//   "top-yacht/pardo-43.html",
//   "top-yacht/mystere.html",
//   "top-yacht/granchi-smeralda.html",
//   "top-yacht/papakeecha.html",
//   "top-yacht/princess-v501.html",
//   "top-yacht/libertas.html",
//   "top-yacht/cobrey-50-fly.html",
//   "top-yacht/prestige-520.html",
//   "top-yacht/riva-rivale-52.html",
//   "top-yacht/princess-v55.html",
//   "top-yacht/milky-way.html",
//   "top-yacht/absolute.html",
//   "top-yacht/prestige-550.html",
//   "top-yacht/riva-62.html",
//   "top-yacht/itama-62.html",
//   "top-yacht/fairline-squadron-58.html",
//   "top-yacht/m-y-just.html",
//   "top-yacht/princess-v65.html",
//   "top-yacht/yacht-ab-68.html",
//   "top-yacht/princess-v70.html",
//   "top-yacht/prestige-680.html",
//   "top-yacht/gien.html",
//   "top-yacht/mangusta-72.html",
//   "top-yacht/sunseeker-manhattan.html",
//   "top-yacht/pearl-yacht.html",
//   "top-yacht/dolce-mia.html",
//   "top-yacht/cristal-1.html",
//   "top-yacht/jps.html",
//   "top-yacht/cristal-11.html",
//   "top-yacht/falcon-86.html",
//   "top-yacht/custom-line.html",
//   "top-yacht/astro.html",
//   "top-yacht/mangusta-103.html",
//   "top-yacht/majesty-yacht.html",
//   "top-yacht/mangusta-105.html",
//   "top-yacht/jff.html",
//   "top-yacht/leopard-34.html",
//   "top-yacht/leopard-341.html",
//   "top-yacht/san-lorenzo-118.html",
//   "top-yacht/sunseeker-40m.html",
//   "top-yacht/sunseeker155.html",
//   "top-yacht/blue-magic.html",
//   "top-yacht/z-e-p-t-e-r.html",
// ];

function getYachtPrice($) {
  const simplePriceRegex = /(\d+.?\d+)€/mu;
  const priceFromHoursAndDaysRegex = /\d(?:days|hours)–(\d+.?\d+)€/mu;
  const allSpacesAndReturnRegex = /(\n)|(\s+)/gmu;

  const $fullDayPriceCard = $('#SVGwave1BottomShapeID2 h3:contains("Full Day")');
  const $charterPackPriceCard = $('#SVGwave1BottomShapeID2:contains("Charter pack")');

  if ($fullDayPriceCard.length) {
    const fullDayPriceText = $fullDayPriceCard.next().text().trim().replace(allSpacesAndReturnRegex, "");
    const fullDayPrice = simplePriceRegex.exec(fullDayPriceText)[1];
    return fullDayPrice.replace(".", "").replace(",", "").replace(/^\d–/gmu, "");
  }

  if ($charterPackPriceCard.length) {
    const charterPackPriceText = $charterPackPriceCard.next().text().trim().replace(allSpacesAndReturnRegex, "");
    const charterPackPrice = priceFromHoursAndDaysRegex.exec(charterPackPriceText);
    if (charterPackPrice !== null) return charterPackPrice[1].replace(".", "").replace(",", "").replace(/^\d–/gmu, "");

    return simplePriceRegex.exec(charterPackPriceText)[1].replace(".", "").replace(",", "").replace(/^\d–/gmu, "");
  }

  return null;
}

async function getYachtData(path) {
  const yachtHtml = await getHtml(path);
  if (!yachtHtml) return null;
  const $ = cheerio.load(yachtHtml);

  const $techAttsBlock = $('h2:contains("Technical specifications")').parent().parent();

  // Регулярное выражения для получения целого или дробного числа записанного через точку
  const lengthRegex = /\d+\.?\d*/m;
  const digitalRegex = /\d+/gu;

  const $length = $techAttsBlock.find('span:contains("Length:")');
  const $guests = $techAttsBlock.find('span:contains("Guests:")');
  const $cabins = $techAttsBlock.find('span:contains("Cabins:")');
  const $year = $techAttsBlock.find('span:contains("Year built:")');

  const name = $("h1").text().trim();
  const price = getYachtPrice($);
  const length = $length.length ? Number.parseFloat(lengthRegex.exec($length.next().text().trim())[0]) : undefined;
  const guests = $guests.length ? Number.parseInt($guests.next().text().trim(), 10) : undefined;
  const cabins =
    $cabins.length && $cabins.next().text().trim() !== "-"
      ? Number.parseInt($cabins.next().text().trim(), 10)
      : undefined;
  const years = $year.length ? $year.next().text().trim().matchAll(digitalRegex) : undefined;
  const [year, restorationYear] = years ? Array.from(years, (match) => match[0]) : [undefined, undefined];

  const gallery = [];

  const $gallery = $("#SVGwave1BottomSMShapeID2 .js-slick-carousel img");

  for (const $img of $gallery) {
    const regexRemoveImageResizeSubstring = /-\d+x\d+-.+\./g;
    const src = $($img).attr("src");
    const imgPath = String(src).replace(regexRemoveImageResizeSubstring, ".").replace("/cache", "");
    gallery.push(url + imgPath);
  }

  const yachtData = {
    name,
    price,
    language: "",
    wooAttrLengthID: "Длина",
    length,
    wooAttrGuestsID: "Гости",
    guests,
    wooAttrCabinsID: "Каюты",
    cabins,
    wooAttrYearID: "Год постройки",
    year,
    wooAttrRestorationYearID: "Год реставрации",
    restorationYear,
    gallery: gallery.join(", "),
  };

  const pllID = "pll_" + uuidv5(url + path, uuidv5.URL);

  return languages.map((lg) => ({
    ...yachtData,
    language: lg,
    polyLangID: pllID,
  }));
}

async function parseAllYachtsData(yachtPages) {
  let yachtsData = [];
  // Get all yachts data
  console.log("Start parsing all yachts data");
  for (const link of yachtPages) {
    console.log("Start parsing link:", link);
    const yachtData = await getYachtData(link);
    if (yachtData) {
      yachtsData = [...yachtsData, ...yachtData];
      console.log("Finish parsing yacht:", yachtData[0].name);
    } else {
      console.log("Error while parsing yacht");
    }
  }
  console.log("Finish parsing all yachts data");

  return yachtsData;
}

const yachtCatalogHtml = await axios.get(url + "/top-yacht/");
const $ = cheerio.load(yachtCatalogHtml.data);
const pageLinks = $("h4 a.cbp-caption")
  .map((i, el) => $(el).attr("href"))
  .toArray();

const parseResult = await parseAllYachtsData(pageLinks);
// save yacht data to file
writeFileSync("yachts.json", JSON.stringify(parseResult, null, 2));

stringify(
  parseResult,
  {
    header: true,
    columns: {
      name: "Имя",
      price: "Базовая цена",
      language: "Language",
      wooAttrLengthID: "Название атрибута 1",
      length: "Значения атрибутов 1",
      wooAttrGuestsID: "Название атрибута 2",
      guests: "Значения атрибутов 2",
      wooAttrCabinsID: "Название атрибута 3",
      cabins: "Значения атрибутов 3",
      wooAttrYearID: "Название атрибута 4",
      year: "Значения атрибутов 4",
      wooAttrRestorationYearID: "Название атрибута 5",
      restorationYear: "Значения атрибутов 5",
      polyLangID: "Translation group",
      gallery: "Изображения",
    },
  },
  (err, output) => {
    writeFileSync("yachts.csv", "\ufeff" + output);
  }
);
