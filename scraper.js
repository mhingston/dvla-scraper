const puppeteer = require('puppeteer');
const request = require('request-promise-native');

const scraper = async ({adapter, readOptions = {}, updateOptions = {}}) =>
{
    const scrape = async () =>
    {
        const {data, meta} = await adapter.read({batchSize: readOptions.batchSize});

        if(!data)
        {
            return;
        }
    
        for(let row of data)
        {
            row.MOTDueDate = row.MOTExpired = row.TaxDueDate = row.SORN = null;

            try
            {
                await page.goto('https://vehicleenquiry.service.gov.uk/');
                await page.type('#Vrm', row.RegNo);
                await page.click('[name="Continue"]');
                await page.waitFor('#Correct_True', {timeout: 5000});
                await page.click('#Correct_True');
                await page.click('[name="Continue"]');
                await page.waitFor('.reg-mark', {timeout: 5000});
                const additionalData = await page.evaluate((dateFns) =>
                {
                    eval(dateFns); // workaround until puppeteer #1229 is fixed. See: https://github.com/GoogleChrome/puppeteer/issues/1229
                    const data = {};
                    const containers = $('div.status-bar > div.column-half');
                    const taxContainer = containers.eq(0);
                    const motContainer = containers.eq(1);

                    if(taxContainer)
                    {
                        const dateMatch = taxContainer.find('p').text().match(/Tax due:(\d{2} \w+ \d{4})/);

                        if(dateMatch)
                        {
                            const date = window.dateFns.parse(dateMatch[1], 'DD MMMM YYYY');

                            if(window.dateFns.isValid(date))
                            {
                                data.TaxDueDate = window.dateFns.format(date, 'DD/MM/YYYY');
                            }
                        }

                        else if(taxContainer.find('h2').text().match(/SORN/))
                        {
                            data.SORN = 'Yes';
                        }
                    }

                    if(motContainer)
                    {
                        const expiresMatch = motContainer.find('p').text().match(/Expires:(\d{2} \w+ \d{4})/);
                        const expiredMatch = motContainer.find('p').text().match(/Expired:(\d{2} \w+ \d{4})/);

                        if(expiresMatch)
                        {
                            const date = window.dateFns.parse(expiresMatch[1], 'DD MMMM YYYY');
                            data.MOTDueDate = window.dateFns.format(date, 'DD/MM/YYYY');
                        }

                        else if(expiredMatch)
                        {
                            const date = window.dateFns.parse(expiredMatch[1], 'DD MMMM YYYY');
                            data.MOTExpired = window.dateFns.format(date, 'DD/MM/YYYY');
                        }
                    }

                    const regDate = window.dateFns.parse($('li#UKRegistrationDateDummyDateV5CMatch').find('strong').text(), 'MMMM YYYY');

                    if(window.dateFns.isValid(regDate))
                    {
                        data.RegDate = window.dateFns.format(regDate, 'DD/MM/YYYY');
                    }

                    return data;
                }, dateFns);
                
                row = Object.assign(row, additionalData);
            }

            catch(error)
            {
                console.log(error.message);
            }
        };

        await adapter.update(
        {
            data,
            meta,
            options: updateOptions
        });

        return scrape();
    }

    const browser = await puppeteer.launch(
    {
        args:
        [
            '--no-sandbox'
        ]
    });
    const page = await browser.newPage();
    const dateFns = await request('http://cdn.date-fns.org/v2.0.0-alpha0/date_fns.min.js', {gzip: true}); // need to use >= v2.0.0-alpha6 for dates to be parsed correctly with a custom format
    await scrape();
    await browser.close();
}

module.exports = scraper;