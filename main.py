#
# main.py
# Mich, 2015-03-11
# Copyright (c) 2015 Datacratic Inc.  All rights reserved.
#
# The "plugin" variable is defined by the mldb loader

if False:
    # mute pep8 validation
    mldb = None

mldb.log("Loading kmeans generator plugin")
mldb.plugin.serve_static_folder('/files', 'webUiFiles')

def request_handler(mldb, remaining, verb, resource, rest_params, payload,
                    content_type, content_length, headers):
    if verb == "PUT":
        if remaining == "/run/reddit":
            from data_loaders.reddit import load_data
        elif remaining == "/run/stackexchange":
            from data_loaders.stackexchange import load_data
        return load_data(mldb, payload)

mldb.plugin.set_request_handler(request_handler)
