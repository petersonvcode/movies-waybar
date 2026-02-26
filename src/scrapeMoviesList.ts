#!/usr/bin/env node
import { chromium, type Browser, type BrowserContext, type Locator, type Page } from 'playwright';
import { insertMovies } from './db.js';

export type ScrappedMovie = {
  id: string
  /** ISO 8601 string date */
  scrappedAt: string
  rawOriginHTML: string
  place: string
  imageURL: string
  eventName: string
  when: string
  moreInfoURL: string
  startTime: string
  endTime: string
  description: string
}

const timeout = 20 * 1000;
let browserSingleton: Browser | null = null;

export const scrapeMoviesList = async () => {
  try {
    console.log('Scraping movies list ...')
    browserSingleton = await chromium.launch({ headless: true, timeout });
    const content = await scrapeMovies(browserSingleton);
    console.log(`Scraped ${content.length} movies`)
    
    // fs.writeFileSync('movies.json', JSON.stringify(content, null, 2));
    // const content = JSON.parse(fs.readFileSync('movies.json', 'utf8')) as ScrappedMovie[];
    console.log('Inserting movies into database ...')
    insertMovies(content);
    console.log('Movies inserted into database')

    return content;
  } catch (error) {
    console.error('ERROR: ', error);
    throw error;
  } finally {
    await browserSingleton?.close();
  }
}

const baseUrl = 'https://guia.curitiba.pr.gov.br'

const scrapeMovies = async (browser: Browser) => {
  let page: Page | null = null;
  try {
    let movies: ScrappedMovie[] = [];
  
    const url = `${baseUrl}/Evento/Listar/?pesquisa=cinemateca`
    // User agent and sesc-ch-ua are required to avoid being blocked by bot detection
    const context = await browser.newContext({
      userAgent: 'MeuPau/1337.420',
      extraHTTPHeaders: { 'sec-ch-ua': '"MeDetectaAiKkkkkkk";v="1"' }
    });
    page = await context.newPage();
    await page.goto(url, { timeout });
    await page.waitForLoadState('networkidle', { timeout });

    const allCards = page.locator('body > section:nth-child(7) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(4) > div:nth-child(1) > div')
    if (!allCards)
      throw new Error('all cards div not found');

    const moviesLocators = await allCards.all();
    const promises = moviesLocators.map(async (movieLocator, i) => {
      let response: ScrappedMovie | undefined;
      let retries = 0;
      let maxRetries = 3
      while (retries < maxRetries && !response) {
        try {
          response = await parseMovieCard(context, movieLocator)
        } catch (error) {
          console.log(`Error parsing movie card ${i} for the ${retries} time: ${error}`);
          retries++
        }
      }
      if (retries === maxRetries) {
        console.error(`Failed to parse movie card ${i} after ${maxRetries} retries`);
        throw new Error(`Failed to parse movie card ${i} after ${maxRetries} retries`);
      }
      if (retries > 0 && response) {
        console.log(`retries worked for movie card ${i} after ${retries} retries`)
      }

      return response
    });
    const parsedMovies = await Promise.all(promises);
    movies = parsedMovies.filter(movie => movie !== undefined);
  
    await page.close()
  
    return movies;
  } catch (error) {
    console.error('ERROR scraping movies list: ', (error instanceof Error ? error.message : String(error)));
    throw error;
  } finally {
    page?.close()
  }
}

const parseMovieCard = async (context: BrowserContext, cardLocator: Locator): Promise<ScrappedMovie | undefined> => {
  let moreInfoPage: Page | null = null;
  try {

    let rawOriginHTML = await cardLocator.innerHTML()
    rawOriginHTML = rawOriginHTML.replaceAll(/\n/g, '').replaceAll(/\t/g, '');
  
    let place = await cardLocator.locator('.evento-conteudo div p a').innerText()
    place = place.trim().toLowerCase()
    if (!place) {
      console.error('place not found');
      return
    }
    if (place !== 'cinemateca de curitiba') {
      console.error('place is not cinemateca de curitiba');
      return
    }
  
    let imageURL = await cardLocator.locator('.evento-midia img').getAttribute('src')
    if (!imageURL) imageURL = 'https://mid-noticias.curitiba.pr.gov.br/2025/00489724.jpg'
  
    let eventName = await cardLocator.locator('.evento-conteudo h5').innerText()
    eventName = eventName.trim()
    if (!eventName) eventName = 'Evento sem nome'
  
    let when = await cardLocator.locator('.evento-conteudo p.evento-info:first-of-type').innerText()
    when = when.trim()
    if (!when) {
      console.error('when not found');
      return
    }
  
    let moreInfoURL = await cardLocator.locator('.evento-card>a').getAttribute('href')
    if (!moreInfoURL) {
      console.error('moreInfoURL not found');
      return
    }
    moreInfoURL = `${baseUrl}${moreInfoURL}`
  
    moreInfoPage = await context.newPage();
    await moreInfoPage.goto(moreInfoURL, { timeout });
    await moreInfoPage.waitForLoadState('networkidle', { timeout });
  
    let startTime = await moreInfoPage.locator("ul[class='lista-data-evento'] li:nth-child(1)").innerText()
    startTime = startTime.trim()
    if (!startTime) {
      console.error('startTime not found');
      return
    }
  
    let endTime = await moreInfoPage.locator("ul[class='lista-data-evento'] li:nth-child(2)").innerText()
    endTime = endTime.trim()
    if (!endTime) {
      console.error('endTime not found');
      return
    }
  
    let description = await moreInfoPage.locator("#descricao").innerText()
    description = description.trim().replaceAll('\n\n', ' ')
    if (description.toLowerCase().startsWith('descrição')) description = description.slice(10).trim()
    if (!description) {
      console.error('description not found');
      return
    }
  
    let id = moreInfoURL.slice(baseUrl.length).replaceAll('/', '-')
    if (id.startsWith('-')) id = id.slice(1)
    if (id.endsWith('-')) id = id.slice(0, -1)
  
    await moreInfoPage.close();
  
    return {
      id,
      scrappedAt: new Date().toISOString(),
      rawOriginHTML,
      place,
      imageURL,
      eventName,
      when,
      moreInfoURL,
      startTime,
      endTime,
      description,
    }
  } catch (error) {
    console.error('ERROR parsing movie card: ', (error instanceof Error ? error.message : String(error)));
    throw error;
  } finally {
    moreInfoPage?.close()
  }
}

scrapeMoviesList()