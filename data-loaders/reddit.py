#
# reddit.py
# Mich, 2015-02-11
# Copyright (c) 2015 Datacratic Inc.  All rights reserved.
#

import urllib
import gzip
import csv
from datetime import datetime


if False:
    # there to silence flake8 about plugin being undefined
    mldb = None

mldb.log("Reddit data loader started")
dataset_id = 'reddit_dataset'
mldb.script.set_return({'dataset_id' : dataset_id})

dataset_config = {
    'type'    : 'mutable',
    'id'      : 'reddit_dataset',
    'address' : 'reddit_dataset.beh.gz'  # where to save the import
}
dataset = mldb.create_dataset(dataset_config)
mldb.log("Reddit data loader created dataset")

# saves it as a temporary file
dataset_address = \
    'http://files.figshare.com/1310438/reddit_user_posting_behavior.csv.gz'
reddit_csv_gz = urllib.urlretrieve(dataset_address)
mldb.log("Reddit data loader downloaded data")

reddit_csv = gzip.open(reddit_csv_gz[0])
mldb.log("Reddit data loader opened gzip file")
reddit = csv.reader(reddit_csv)
mldb.log("Reddit data loader loaded csv")

now = datetime.now()  # foo date, timeless features

count = 0
for row in reddit:
    triplet = [[row[0], '1', now]]
    for k in row[1:]:
        if count == 0:
            mldb.log("Reddit data loader first line: {}, {}"
                       .format(k, triplet))
        dataset.record_row(k, triplet)
        if count == 0:
            mldb.log("Reddit data loader recorded first row")
        count += 1
        if count == 20000:
            mldb.log("Reddit data loader stopping at 20k lines")
            break
    else:
        continue
    break


dataset.commit()
