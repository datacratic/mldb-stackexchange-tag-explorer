/**
 * script.js
 * Mich, 2015-03-11
 * Copyright (c) 2015 Datacratic Inc.  All rights reserved.
 **/

$(function () {
    var datasetName = null;
    var kMeansGroups = null;
    var dimensions = null;
    var perplexity = 20;

    logTa = $("textarea");
    function log(msg) {
        logTa.append(msg + "\n").scrollTop(logTa[0].scrollHeight);
    }

    function setFormActiveState(bool) {
        $(this).find("input, button, select").prop("disabled", !bool);
    }

    function getTsneId() {
        return datasetName + "_tsne_" + dimensions + "_" + perplexity;
    }

    function getKmeansId() {
        return datasetName + "_kmeans_" + kMeansGroups;
    }

    function getMergedDatasetId() {
        return datasetName + "_merged_" + kMeansGroups + "_" + dimensions + "_"
            + perplexity;
    }

    function getAjaxOnError(msg) {
        return function ajaxOnError(jqXHR, textStatus, errorThrown) {
            setFormActiveState(true);
            log(msg + " Check console for more info.");
            console.log(jqXHR);
            console.log(textStatus);
            console.log(jqXHR.responseText);
            throw errorThrown;
        }
    }

    function clearDisplayedResult() {
        $("#result").html("");
    }

    function displayResult() {
        if (dimensions == 2) {
            display2dResults();
        }
        else if (dimensions == 3) {
            display3dResults();
        }
        else {
            throw("Unknown dimensions: " + dimensions);
        }
    }

    function getCol(name, cols) {
        for (var i in cols) {
            if (cols[i][0] === name) {
                return cols[i];
            }
        }
    }

    function display3dResults() {
        //data:text/html,
        var url = "/v1/datasets/" + getMergedDatasetId() + "/query";
        $.getJSON(url, function(rawData) {
            var points = [];
            for (var i in rawData) {
                var item = rawData[i].columns;
                points.push({
                    x : getCol("x", item)[1],
                    y : getCol("y", item)[1],
                    z : getCol("z", item)[1],
                    cid : getCol("cluster", item)[1]
                })
            }
            $.get("data_projector.html", function(htmlStr) {
                var index = htmlStr.lastIndexOf("</head>");
                var block2 = htmlStr.substr(index);
                var block1 = htmlStr.substr(0, index);
                index = block2.lastIndexOf("</body>");
                var block3 = block2.substr(index);
                var block2 = block2.substr(0, index);
                var path = location.toString();
                path = path.substr(0, path.lastIndexOf("/") + 1);
                htmlStr = block1
                    + '<link rel="stylesheet" type="text/css" href="' + path + 'DataProjector.css">'
                    + block2
                    + '<script type="text/javascript" src="' + path + 'TrackballControls.js"></script>'
                    + '<script type="text/javascript" src="' + path + 'DataProjector.js"></script>'
                    + '<script type="text/javascript">\n'
                    + '$(function() {\n'
                    + '    new DataProjector({points : ' + JSON.stringify(points) + '});\n'
                    + '});\n'
                    + '</script>'
                    + block3;
                $("#result").html('<iframe style="width: 100%; height: 800px;" src="data:text/html,' + encodeURIComponent(htmlStr) + '"></iframe>')
            });
        });
    }

    function display2dResults() {
        $("svg").remove();

        function getMinMax(data) {
            var min = 0;
            var max = 0;
            var cols;
            var colX;
            var colY;
            for (var i in data) {
                cols = data[i].columns;
                colX = getCol('x', cols);
                colY = getCol('y', cols);
                min = Math.min(colX[1], colY[1], min);
                max = Math.max(colX[1], colY[1], max);
            }
            return [min, max];
        }

        var color;
        var scale;
        var topOffset = 10;
        var leftOffset = 30;
        label = $("<span></span>").appendTo("div").css({
            position : "absolute",
            background : "rgba(0, 0, 0, 0.4)",
            color : "white"
        });
        function showLabel(d) {
            label.show();
            label.html(d.rowName);
            label.css({
                left : leftOffset
                    + scale(getCol('x', d.columns)[1])
                    - (label.outerWidth() / 2),
                top  : 10 + topOffset + scale(getCol('y', d.columns)[1])
            });
        }

        function hideLabel() {
            label.hide();
        }

        function doIt(data) {
            color = d3.scale.category20();
            scale = d3.scale
                .linear()
                .domain(getMinMax(data))
                .range([0, 800]);
            $("#result svg").html("");
            var svg = d3.select("#result")
                .append("svg")
                .attr("width", "840px")
                .attr("height", "830px");
            var circles = svg.selectAll("circle")
                .data(data)
                .enter()
                .append("circle")
                .attr("cx", function(d) {
                    return leftOffset + scale(getCol('x', d.columns)[1]);
                })
                .attr("cy", function(d) {
                    return topOffset + scale(getCol('y', d.columns)[1]);
                })
                .attr("r", 5)
                .attr("fill", function (d) {
                    return color(getCol('cluster', d.columns)[1]);
                })
                .on("mouseover", function (d) {
                    showLabel(d);
                })
                .on("mouseout", function (d) {
                    hideLabel();
                });
        }

        var url = "/v1/datasets/" + getMergedDatasetId() + "/query";
        $.getJSON(url, function(data) {
            doIt(data);
        });
    }

    function createMergedDataset() {
        var mergedDatasetId = getMergedDatasetId();
        $.ajax({
            method : "GET",
            url : "/v1/datasets/" + mergedDatasetId,
            success : displayResult,
            error : function() {
                log("Creating merged dataset");
                config = {
                    'type' : "merged",
                    'id' : mergedDatasetId,
                    'params' : {
                        "datasets": [
                            {"id": getTsneId()},
                            {"id": getKmeansId()}
                        ]
                    }
                };
                $.ajax({
                    method : "POST",
                    url : "/v1/datasets",
                    data : JSON.stringify(config),
                    error : getAjaxOnError("Failed to create merged dataset"),
                    success : function() {
                        log("Created merged dataset");
                        displayResult();
                    }
                });
            }
        });
    }

    function trainTsnePipeline() {
        log("Training tsne pipeline");
        $.ajax({
            method : "PUT",
            url : "/v1/pipelines/" + getTsneId() + "/runs/1",
            data : "{}",
            error : getAjaxOnError("Failed to train tsne pipeline"),
            success : function() {
                log("Created tsne pipeline");
                createMergedDataset();
            }
        })
    }

    function createTsnePipeline() {
        var tsneId = getTsneId();
        $.ajax({
            method : "GET",
            url : "/v1/pipelines/" + tsneId,
            success : createMergedDataset,
            error : function () {
                log("Creating tsne pipeline");
                config = {
                    'type' : 'tsne',
                    'params' : {
                        'dataset' : {'id' : datasetName + '_svd_embedding'},
                        'output' : {'id' : tsneId,
                                    'type' : 'mutable',
                                    'address' : datasetName + 'reddit_tsne.beh.gz'},
                        'select' : 'svd*',
                        'where' : 'true',
                        'numOutputDimensions' : dimensions,
                        'perplexity' : perplexity
                    }
                };
                $.ajax({
                    method : "PUT",
                    url : "/v1/pipelines/" + tsneId,
                    data : JSON.stringify(config),
                    error : getAjaxOnError("Failed to create tsne pipeline."),
                    success : function() {
                        log("Created tsne pipeline.");
                        trainTsnePipeline();
                    }
                });
            }
        });
    }

    function trainKmeansPipeline() {
        log("Training kmeans pipeline.");
        $.ajax({
            method : "PUT",
            url : "/v1/pipelines/" + getKmeansId() + "/runs/1",
            data : "{}",
            error : getAjaxOnError("Failed to train kmeans pipeline"),
            success : function() {
                log("Trained kmeans pipeline.");
                createTsnePipeline();
            }
        })
    }

    function createKmeansPipeline() {
        var kmeansId = getKmeansId();
        $.ajax({
            method : "GET",
            url : "/v1/pipelines/" + kmeansId,
            success : createTsnePipeline,
            error : function () {
                log("Creating kmeans pipeline");
                config = {
                    'type' : 'kmeans',
                    'params' : {
                        'dataset' : {'id' : datasetName + '_svd_embedding'},
                        'output' : {'id' : kmeansId,
                                    'type' : 'mutable',
                                    'address' : datasetName + '_kmeans.beh.gz'},
                        'select' : 'svd*',
                        'where' : 'true',
                        'numClusters' : kMeansGroups
                    }
                };
                $.ajax({
                    method : "PUT",
                    url : "/v1/pipelines/" + kmeansId,
                    data : JSON.stringify(config),
                    error : getAjaxOnError("Failed to create kmeans pipeline."),
                    success : function() {
                        log("Created kmeans pipeline.");
                        trainKmeansPipeline();
                    }
                });
            }
        });
    }

    function trainSvdPipeline() {
        log("Training svd pipeline.");
        $.ajax({
            method : "PUT",
            url : "/v1/pipelines/" + datasetName + "_svd/runs/1",
            data : "{}",
            error : getAjaxOnError("Failed to train svd pipeline."),
            success : function() {
                log("Trained svd pipeline.");
                createKmeansPipeline()
            }
        });
    }

    function createSvdPipeline() {
        var svdId = datasetName + '_svd';
        $.ajax({
            method: "GET",
            url : "/v1/pipelines/" + svdId,
            success: createKmeansPipeline,
            error: function () {
                log("Creating svd pipeline");
                config = {
                    'type' : 'svd',
                    'params' : {
                        'dataset' : {'id' : datasetName},
                        'output' : {'id' : svdId,
                                    'type' : 'mutable',
                                    'address' : datasetName + '_svd.beh.gz'},
                        'rowOutput' : {"id": datasetName + "_svd_embedding",
                                    'type': "embedding",
                                    'address' : datasetName + "_svd.embedding.gz" },
                        'select' : '* EXCLUDING (label)'
                    }
                };
                $.ajax({
                    method: "PUT",
                    url : "/v1/pipelines/" + svdId,
                    data : JSON.stringify(config),
                    error : getAjaxOnError("Failed to create svd pipeline"),
                    success : function() {
                        log("Created svd pipeline.");
                        trainSvdPipeline();
                    }
                });
            }
        });
    }

    function logCount(data) {
        if (data.count === undefined) {
            log("Unknown data points count.");
        }
        else {
            log("Got " + data.count + " data points.");
        }
    }

    function logQuotaRemaining(data) {
        if (data.quotaRemaining !== undefined) {
            log("Quota remaining: " + data.quotaRemaining);
        }
    }

    function onDataLoaded(data, textStatus, jqXHR) {
        log("Data loaded successfully.");
        datasetName = data.datasetId;
        if (datasetName === undefined) {
            log("ERROR: The data loader failed to return the dataset name.");
            return;
        }
        logQuotaRemaining(data);
        log("Dataset name: " + datasetName);
        logCount(data);
        $.ajax({
            url :"/v1/datasets/" + datasetName,
            success : function() {
                log("Dataset found.");
                createSvdPipeline();
            }, error : getAjaxOnError("Failed to find dataset. Was it named properly?")
        });
    }

    function getDataLoaderConfig() {
        var option = $("select[name=method]").val();
        if (option == "file") {
            return {
                method : "POST",
                url : "/v1/types/plugins/python/routes/run",
                data : {
                    address : $("input[name=importScriptUri]").val()
                }
            };
        }
        else if (option == "so") {
            return {
                method : "PUT",
                url : '../run/stackexchange',
                data : {
                    site : $("select[name=stackexchangeSite]").val(),
                    key : $("input[name=stackexchangeKey]").val()
                }
            };
        }
        else if (option == "reddit") {
            return {
                method : "PUT",
                url : '../run/reddit'
            };
        }
        throw("Unknown option");
    }

    $("form").submit(function(e) {
        clearDisplayedResult();
        kMeansGroups = parseInt($("input[name=kMeansGroups]").val());
        dimensions = parseInt($("input[name=dimensions]:checked").val());
        perplexity = parseInt($("input[name=perplexity]").val());
        e.preventDefault();
        setFormActiveState(false);
        var params = getDataLoaderConfig();

        log("Loading data.");
        $.ajax({
            method : params.method,
            url : params.url,
            data : JSON.stringify(params.data),
            success : onDataLoaded,
            error : getAjaxOnError("Failed to import data.")
        });
    });

    function onMethodChange() {
        var selection = $("select").val();
        $(".selectOption").each(function() {
            if ($(this).hasClass("selectOption-" + selection)) {
                $(this).show();
            }
            else {
                $(this).hide();
            }
        });
    }
    onMethodChange();
    $("select").change(onMethodChange);

    $.get("stackexchange_options.html", function (data) {
        $("select[name=stackexchangeSite]").html(data);
    });
});
