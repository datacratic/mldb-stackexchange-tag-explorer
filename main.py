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
