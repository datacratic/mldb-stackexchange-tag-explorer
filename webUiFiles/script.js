/**
 * script.js
 * Mich, 2015-03-11
 * Copyright (c) 2015 Datacratic Inc.  All rights reserved.
 **/

$(function () {
    var datasetName = null;
    var kMeansGroups = null;
    logTa = $("textarea");
    function log(msg) {
        logTa.append(msg + "\n").scrollTop(logTa[0].scrollHeight);
    }
    // activate python runner plugin, should it be needed
    $.ajax({
        method : "PUT",
        url : "/v1/plugins/pyrunner?sync=true",
        data : JSON.stringify({"type" : "python_runner"}),
        success : function() { log("Registered python plugin."); },
        error : function() { log("Python plugin likely already registered."); }
    });

    function setFormActiveState(bool) {
        $(this).find("input, button, select").prop("disabled", !bool);
    }

    function getAjaxOnError(msg) {
        return function ajaxOnError(jqXHR, textStatus, errorThrown) {
            setFormActiveState(true);
            log(msg + " Check console for more info.");
            console.log(jqXHR);
            console.log(textStatus);
            throw errorThrown;
        }
    }

    function displayResult() {
        function getCol(name, cols) {
            for (var i in cols) {
                if (cols[i][0] === name) {
                    return cols[i];
                }
            }
        }

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

        var url = "/v1/datasets/" + datasetName + "_merged/query";
        $.getJSON(url, function(data) {
            doIt(data);
        });
    }

    function createMergedDataset() {
        log("Creating merged dataset");
        config = {
            'type' : "merged",
            'id' : datasetName + "_merged",
            'params' : {
                "datasets": [
                    {"id": datasetName + "_tsne"},
                    {"id": datasetName + "_kmeans"}
                ]
            }
        };
        $.ajax({
            method : "POST",
            url : "/v1/datasets?sync=true",
            data : JSON.stringify(config),
            error : getAjaxOnError("Failed to create merged dataset"),
            success : function() {
                log("Created merged dataset");
                displayResult();
            }
        })
    }

    function trainTsnePipeline() {
        log("Training tsne pipeline");
        $.ajax({
            method : "PUT",
            url : "/v1/pipelines/" + datasetName + "_tsne/trainings/1?sync=true",
            data : "{}",
            error : getAjaxOnError("Failed to train tsne pipeline"),
            success : function() {
                log("Created tsne pipeline");
                createMergedDataset();
            }
        })
    }

    function createTsnePipeline() {
        log("Creating tsne pipeline");
        config = {
            'type' : 'tsne',
            'params' : {
                'dataset' : {'id' : datasetName + '_svd_embedding'},
                'output' : {'id' : datasetName + '_tsne',
                            'type' : 'mutable',
                            'address' : datasetName + 'reddit_tsne.beh.gz'},
                'select' : 'svd*',
                'where' : 'true'
            }
        };
        $.ajax({
            method : "PUT",
            url : "/v1/pipelines/" + datasetName + "_tsne?sync=true",
            data : JSON.stringify(config),
            error : getAjaxOnError("Failed to create tsne pipeline."),
            success : function() {
                log("Created tsne pipeline.");
                trainTsnePipeline();
            }
        })
    }

    function trainKmeansPipeline() {
        log("Training kmeans pipeline.");
        $.ajax({
            method : "PUT",
            url : "/v1/pipelines/" + datasetName + "_kmeans/trainings/1?sync=true",
            data : "{}",
            error : getAjaxOnError("Failed to train kmeans pipeline"),
            success : function() {
                log("Trained kmeans pipeline.");
                createTsnePipeline();
            }
        })
    }

    function createKmeansPipeline() {
        log("Creating kmeans pipeline");
        config = {
            'type' : 'kmeans',
            'params' : {
                'dataset' : {'id' : datasetName + '_svd_embedding'},
                'output' : {'id' : datasetName + '_kmeans',
                            'type' : 'mutable',
                            'address' : datasetName + '_kmeans.beh.gz'},
                'select' : 'svd*',
                'where' : 'true',
                'numClusters' : kMeansGroups
            }
        };
        $.ajax({
            method : "PUT",
            url : "/v1/pipelines/" + datasetName + "_kmeans?sync=true",
            data : JSON.stringify(config),
            error : getAjaxOnError("Failed to create kmeans pipeline."),
            success : function() {
                log("Created kmeans pipeline.");
                trainKmeansPipeline();
            }
        })
    }

    function trainSvdPipeline() {
        log("Training svd pipeline.");
        $.ajax({
            method : "PUT",
            url : "/v1/pipelines/" + datasetName + "_svd/trainings/1?sync=true",
            data : "{}",
            error : getAjaxOnError("Failed to train svd pipeline."),
            success : function() {
                log("Trained svd pipeline.");
                createKmeansPipeline()
            }
        });
    }

    function createSvdPipeline() {
        log("Creating svd pipeline");
        config = {
            'type' : 'svd',
            'params' : {
                'dataset' : {'id' : datasetName},
                'output' : {'id' : datasetName + '_svd',
                            'type' : 'mutable',
                            'address' : datasetName + '_svd.beh.gz'},
                'rowOutput' : {"id": datasetName + "_svd_embedding",
                            'type': "embedding",
                            'address' : datasetName + "_svd.embedding.gz" },
                'select' : '* EXCLUDING label'
            }
        };
        $.ajax({
            method: "PUT",
            url : "/v1/pipelines/" + datasetName + "_svd?sync=true",
            data : JSON.stringify(config),
            error : getAjaxOnError("Failed to create svd pipeline"),
            success : function() {
                log("Created svd pipeline.");
                trainSvdPipeline();
            }
        })
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
                url : "/v1/plugins/pyrunner/routes/run?sync=true",
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
        throw("Unknown option");
    }

    $("form").submit(function(e) {
        kMeansGroups = parseInt($("input[name=kMeansGroups]").val());
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
