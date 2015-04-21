#
# stackexchange.py
# Mich, 2015-03-12
# Copyright (c) 2015 Datacratic Inc.  All rights reserved.
#

import requests
import json
from datetime import datetime

def load_data(mldb, payload):
    mldb.log("StackExchange data loader")
    payload = json.loads(payload)
    assert payload['site'], mldb.log("payload: site is undefined")
    page = 0
    has_more = True
    key = None
    if 'key' in payload:
        key = payload['key']
    site = payload['site'].encode("utf-8")
    mldb.log("Got site:" + site.encode("utf-8"))
    dataset_id = site.encode("utf-8") + '_dataset'

    dataset_config = {
        'type'    : 'mutable',
        'id'      : dataset_id,
        'params': { 'artifactUri' : 'file:///mldb_data/' + site + '_dataset.beh.gz' }
    }
    url = "/v1/datasets/" + dataset_id
    result = mldb.perform("GET", url, [], {})
    if result['statusCode'] == 200:
        mldb.log("Dataset was already loaded")
        return {
            'datasetId' : dataset_id,
            'count' : '?',
            'quotaRemaining' : '?'
        }

    dataset = mldb.create_dataset(dataset_config)

    mldb.log("stackexchange data loader created dataset " + dataset_id)
    now = datetime.now()  # foo date, timeless features

    count = 0
    page = 0
    quota_remaining = "Unknown"
    while has_more:
        page += 1
        params = {
            'site' : site,
            'pagesize' : 100,
            'page' : page
        }
        if key:
            params['key'] = key
        r = requests.get('https://api.stackexchange.com/2.2/questions',
                        params=params)
        assert r.status_code == 200, mldb.log("Failed to fetch questions: "
                                                + r.content)
        result = json.loads(r.content)
        has_more = result['has_more']
        quota_remaining = result['quota_remaining']

        for question in result['items']:
            if len(question['tags']) > 1:
                triplet = [[question['question_id'], '1', now]]
                for tag in question['tags']:
                    tag = tag.encode("utf-8")
                    if count == 0:
                        mldb.log("stackexchange data loader first line: {}, {}"
                                .format(tag, triplet))
                    dataset.record_row(tag, triplet)
                    if count == 0:
                        mldb.log("stackexchange data loader recorded first row")
                    count += 1
                    if count == 20000:
                        mldb.log("stackexchange data loader stopping at 20k lines")
                        has_more = False
                        break
                else:
                    continue
                break

    dataset.commit()
    mldb.log("Fetched {} tags".format(count))
    return {
        'datasetId' : dataset_id,
        'count' : count,
        'quotaRemaining' : quota_remaining
    }
