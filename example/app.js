const scraper = require('../scraper');
const {Spreadsheet} = require('adapters');

const main = async () =>
{
    const adapter = new Spreadsheet(
    {
        data: 'data.xlsx',
        parsingOptions:
        {
            type: 'file'
        },
        worksheets:
        [
            {
                id: 0,
                columns:
                [
                    {
                        id: 0
                    }
                ]
            }
        ]
    });

    await scraper({adapter, readOptions: {batchSize: 1}, updateOptions: {save: true}});
}

main();