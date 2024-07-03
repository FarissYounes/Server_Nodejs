const express = require('express');
const { Client } = require('@elastic/elasticsearch');

const app = express();
const port = 3000;

const client = new Client({ node: 'http://localhost:9200' });

client.ping({}, (error) => {
    if (error) {
        console.error('Elasticsearch cluster is down!', error);
    } else {
        console.log('Connected to Elasticsearch');
    }
});

app.use(express.static('public'));

// Route pour récupérer le nombre d'enregistrements créés dans la dernière minute
app.get('/data', async (req, res) => {
    try {
        const currentTime = new Date();
        const oneMinuteAgo = new Date(currentTime.getTime() - (60 * 1000));
        
        // Delete documents older than the last hour
        await deleteOldDocuments(oneMinuteAgo);

        const { body } = await client.search({
            index: 'Last_minute',
            body: {
                query: {
                    range: {
                        creation_time: {
                            gte: oneMinuteAgo.toISOString(),
                            lte: currentTime.toISOString()
                        }
                    }
                }
            }
        });

        const count = body.hits.total.value;
        res.json({ count: count });
    } catch (error) {
        console.error('Error retrieving data from Elasticsearch:', error);
        res.status(500).send('Error retrieving data from Elasticsearch');
    }
});

// Function to delete documents older than the specified time
async function deleteOldDocuments(olderThan) {
    try {
        const { body } = await client.deleteByQuery({
            index: 'myindex',
            body: {
                query: {
                    range: {
                        creation_time: {
                            lt: olderThan.toISOString()
                        }
                    }
                }
            }
        });
        console.log(`Deleted ${body.deleted} old documents`);
    } catch (error) {
        console.error('Error deleting old documents from Elasticsearch:', error);
    }
}

app.get('/data', async (req, res) => {
    try {
        const response = await client.search({
            index: 'web-page-info',
            body: {
                "size": 0,
                "aggs": {
                    "tickets_per_hour": {
                        "date_histogram": {
                            "field": "creation_time",
                            "interval": "hour",
                            "format": "yyyy-MM-dd HH:mm:ss",
                            "min_doc_count": 0,
                            "extended_bounds": {
                                "min": "now-24h/h",
                                "max": "now/h"
                            }
                        }
                    }
                }
            }
        });

        const data = response.body.aggregations.tickets_per_hour.buckets.map(bucket => ({
            date: bucket.key_as_string,
            count: bucket.doc_count
        }));

        res.json(data);
    } catch (error) {
        console.error('Error fetching data:', error);
        res.status(500).send('Error fetching data');
    }
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
