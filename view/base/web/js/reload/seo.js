/*
 * @category   Reload
 * @package    Reload_Seo
 * @copyright  Copyright (c) 2013-2015 AndCode (http://www.andcode.nl)
 * @license    http://opensource.org/licenses/osl-3.0.php  Open Software License (OSL 3.0)
 *
 * reloadseo contains the default functions for the seo result handling and such.
 * 
 */
var reloadseo = {

    /**
     * The reference of the key up timer.
     * @type int
     */
    keyupTimer: null,

    /**
     * The reference of the ajax request.
     * @type int
     */
    currentRequest: null,

    /**
     * The type of the current action, product or category
     * @type string
     */
    type: null,

    /**
     * The url which should be called when we want to get results.
     * @type string
     */
    url: null,

    /**
     * The variables that will be set from the template.
     * @type {Object}
     */
    vars: {},

    data: {},

    fieldConversion: {
        "reload_seo_keywords": "keywords",
        "reload_seo_synonyms": "synonyms",
    },

    /**
     * checkKey checks the key with the api.
     *
     * @return void
     */
    checkKey: function (vars) {
        if (vars.api_key == null || vars.api_key.length <= 0) {
            reloadseo.setMessage(vars.messages.empty_key, 'error');
        }
        else {
            $reloadseo.ajax({
                url: vars.check_url,
                dataType: 'json'
            }).done(function (data) {
                if ('message' in data) {
                    reloadseo.setMessage(data.message.title.replace('%s', vars.config_url), data.message.type);
                }
                else if (!('key' in data) || data.key != 'valid') {
                    reloadseo.setMessage(vars.messages.default_invalid_message, 'error');
                }
            });
        }
    },

    /**
     * setMessages sets an error or success message.
     *
     * @param string message
     * @param string type
     * @param string id
     */
    setMessage: function (message, type, id) {
        var theMessage = $reloadseo('<li class="' + type + '-msg"><ul><li><span>' + message + '</span></li></ul></li>');
        if (typeof id !== 'undefined') {
            var oldMessage = $reloadseo('#' + id);
            if (oldMessage.length) {
                oldMessage.remove();
            }

            theMessage.attr('id', id);
        }

        var messagesDiv = $reloadseo('#messages');
        var ul = messagesDiv.find('ul.messages').first();
        if (!ul.length) {
            messagesDiv.append($reloadseo('<ul class="messages"></ul>'));


        }

        ul = messagesDiv.find('ul.messages').first();
        ul.append(theMessage);
    },

    /**
     * processUpdates calculates a new score after a product or category has been saved.
     *
     * @param  Array    updateRequests The update requestes.
     * @param  string   message        The message to show when the process starts.
     * @param  string   messageOnDone  The message to show when all scores have been calculated.
     *
     * @return void
     */
    processUpdates: function (updateRequests, message, messageOnDone) {

        $reloadseo(document).ready(function () {
            var count = updateRequests.length;
            if (count > 0) {
                //Set the message.
                reloadseo.setMessage(message, 'notice', 'reload_seo_message');

                //Prepare the done message.
                var doneMessage = {
                    message: messageOnDone,
                    type: 'success'
                };

                //updateRequests.each(function(updateRequest)
                $reloadseo.each(updateRequests, function (index, updateRequest) {
                    //Make the AJAX request for each update request.
                    $reloadseo.ajax({
                        url: updateRequest.url,
                        type: 'post',
                        data: updateRequest.data,
                        dataType: 'json'
                    }).done(function (data) {

                        var scoreData = data;

                        //Send the result to the server.
                        $reloadseo.ajax({
                            url: updateRequest.save_url,
                            type: 'post',
                            data: {
                                score: data,
                                form_key: updateRequest.form_key
                            },
                            dataType: 'json'
                        }).done(function (data) {

                            var requestKey = updateRequest.request_key;
                            var seoResultContainer = $reloadseo('.reload-seo-scores.' + requestKey).first();
                            if (seoResultContainer.length && 'score' in scoreData) {
                                seoResultContainer.find('.seo-score').text(scoreData.score);
                                seoResultContainer.find('.seo-score').css('background-color', scoreData.color);

                                var tbody = seoResultContainer.find('.seo-rules table tbody');
                                tbody.find('tr').remove();

                                scoreData.rules.each(function (rule) {
                                    tbody.append('<tr class="seo-rule"><td class="indicator"><div class="indicator-dot" style="background-color: ' + rule.color + ';"></div></td><td>' + rule.title + '</td></tr>');
                                });
                            }

                            var seoGridResult = $reloadseo('.seo-score-grid.' + requestKey).first();
                            if (seoGridResult.length && 'score' in scoreData) {
                                seoGridResult.html('<div style="background-color: ' + scoreData.color + '; width: 18px; height: 18px; float: left; border-radius: 100px;"></div>' + scoreData.score);
                            }

                            //Remove one from the count.
                            count--;

                            if (data != null) {
                                //We received an error message, change the done message.
                                doneMessage.message = data;
                                doneMessage.type = 'error';
                            }

                            if (count == 0) {
                                //All update requests have been finished, set the message.
                                reloadseo.setMessage(doneMessage.message, doneMessage.type, 'reload_seo_message');
                            }
                        });
                    });
                });
            }
        });
    },

    /**
     * init initializes everything
     * @return void
     */
    init: function () {

        var self = this;

        require(['mage/adminhtml/events'],
            function () {

                if (self.cookieHandler.get('showseo') === 'false') {
                    $reloadseo('body').addClass('hide-seo-results');
                    $reloadseo('.seo-toggle-button').html('Show');
                }

                $reloadseo('.seo-toggle-button').off('click');
                $reloadseo('.seo-toggle-button').on('click', self.toggle);

                //Bind the tinymceBeforeSetContent to add the seo results to the wysiwyg when it's opened.
                varienGlobalEvents.attachEventHandler('tinymceBeforeSetContent', function () {
                    reloadseo.copyResultsToWysiwyg();
                    $reloadseo('.seo-toggle-button').off('click');
                    $reloadseo('.seo-toggle-button').on('click', self.toggle);
                });

                //Bind the showTab event to try and listen to the file upload.
                varienGlobalEvents.attachEventHandler('showTab', function () {
                    if (typeof media_gallery_contentJsObject !== 'undefined') {
                        if (typeof media_gallery_contentJsObject.uploader !== 'undefined' && media_gallery_contentJsObject.uploader != null) {
                            //Wait half a second to let the script initialze the media gallery uploader.
                            setTimeout(function () {
                                if (typeof media_gallery_contentJsObject.uploader.uploader !== 'undefined' && media_gallery_contentJsObject.uploader.uploader != null) {
                                    //Bind the file upload complete event.
                                    media_gallery_contentJsObject.uploader.uploader.addEventListener('complete', function () {
                                        //Trigger the reload.
                                        $reloadseo(".track-seo").first().trigger('change');
                                    });
                                }
                            }, 500);
                        }
                    }
                });

            });

        $reloadseo(".fieldset-wrapper[data-index='search-engine-optimization'] >  .fieldset-wrapper-title").trigger('click');

        if ($reloadseo('#media_gallery_content_grid').length) {
            //Bind all input fields in the images grid to reload the seo results on change.
            $reloadseo('#media_gallery_content_grid').on('keyup', 'input', function () {
                self.updateSeo();
            });
        }

        //Prepare the seo keywords field
        $reloadseo('.reload-seo-keywords-field > .admin__field-control > input').data('track-field', 'keywords');
        $reloadseo('.reload-seo-keywords-field > .admin__field-control > input').addClass('track-seo');

        //Prepare the seo synonyms field
        $reloadseo('.reload-seo-synonyms-field > .admin__field-control > input').data('track-field', 'synonyms');
        $reloadseo('.reload-seo-synonyms-field > .admin__field-control > input').addClass('track-seo');

        if (self.vars.type === 'product') {
            $reloadseo("[name='product[sku]']").addClass('track-seo').data('track-field', 'sku');
            if ($reloadseo("#visibility").length) {
                $reloadseo("#visibility").addClass('track-seo');
            }
        }

        //Loop over the field mapping and add the class track-seo to all fields which belong to the field mapping.
        //Put the external field name in the data-track-field attribute.
        $reloadseo.each(self.vars.field_mapping, function (internal, external) {
            if (self.vars.type === 'product') {
                $reloadseo("[name='product[" + internal + "]']").addClass('track-seo').data('track-field', external).data('track-field-internal', internal);
            } else {
                $reloadseo("[name='general[" + internal + "]']").addClass('track-seo').data('track-field', external).data('track-field-internal', internal);
            }
        });

        //Loop over the custom field mappings if this is a product.
        if (self.vars.type === 'product') {
            $reloadseo.each(self.vars.field_mapping_custom, function (internal, external) {
                $reloadseo("[name='product[" + internal + "]']").addClass('track-seo').data('track-field-custom', external).data('track-field-internal', internal);
            });
        }

        //Bind the key up listener to all fields.
        $reloadseo(".track-seo").bind('keyup', function () {
            //On key up reset the timeout.
            clearTimeout(self.keyupTimer);
            self.keyupTimer = setTimeout(function () {
                //When the timeout is over we want to update the seo.
                self.updateSeo();
            }, 300);
        });

        //Bind the change listener to all fields.
        $reloadseo(".track-seo").bind('change', function () {
            //Clear the key up timeout and update the seo directly.
            clearTimeout(self.keyupTimer);
            self.updateSeo();
        });

        //Collect the initial data.
        self.data = self.collectData();

        $reloadseo('.reload-seo-keywords-field > .admin__field-control > input').select2({
            tags: true,
            placeholder: '',
            tokenSeparators: [","],
            minimumInputLength: 1,
            maximumSelectionLength: 2,
            initSelection: function (element, callback) {
                var asString = $reloadseo('input.reload-seo-keywords-field').val();
                var data = [];
                $reloadseo.each(asString.split(','), function (k, v) {
                    data.push({id: v, text: v});
                });
                callback(data);
            },
            ajax: {
                url: "https://suggestqueries.google.com/complete/search?callback=?",
                dataType: 'jsonp',
                data: function (term, page) {
                    return {q: term, hl: 'en', client: 'firefox'};
                },
                results: function (data, page) {
                    var items = {};

                    $reloadseo.each(data[1], function (k, v) {
                        items[v.toLowerCase()] = v.toLowerCase();

                    });

                    var input = $reloadseo('input.reload-seo-keywords-field').data().select2.search.val();
                    $reloadseo.each(input.split(','), function (k, v) {
                        items[v.toLowerCase()] = v.toLowerCase();
                    });

                    var results = [];
                    results.push({id: input.toLowerCase(), text: input.toLowerCase()});
                    $reloadseo.each(items, function (k, v) {
                        results.push({id: v, text: v});
                    });

                    return {results: results};
                },
            }
        });

        $reloadseo('input.reload-seo-keywords-field').on('select2-selecting', function (e) {
            //A new option is being selected, clear the rest.
            $reloadseo(this).data('select2').data([]);
        });

        $reloadseo('.reload-seo-synonyms-field > .admin__field-control > input').select2({
            tags: true,
            placeholder: '',
            tokenSeparators: [","],
            minimumInputLength: 1,
            maximumSelectionLength: 2,
            initSelection: function (element, callback) {
                var asString = $reloadseo('input.reload-seo-synonyms-field').val();
                var data = [];
                $reloadseo.each(asString.split(','), function (k, v) {
                    data.push({id: v, text: v});
                });
                callback(data);
            },
            ajax: {
                url: "https://suggestqueries.google.com/complete/search?callback=?",
                dataType: 'jsonp',
                data: function (term, page) {
                    return {q: term, hl: 'en', client: 'firefox'};
                },
                results: function (data, page) {
                    var items = {};

                    $reloadseo.each(data[1], function (k, v) {
                        items[v.toLowerCase()] = v.toLowerCase();

                    });

                    var input = $reloadseo('input.reload-seo-synonyms-field').data().select2.search.val();
                    $reloadseo.each(input.split(','), function (k, v) {
                        items[v.toLowerCase()] = v.toLowerCase();
                    });

                    var results = [];
                    results.push({id: input.toLowerCase(), text: input.toLowerCase()});
                    $reloadseo.each(items, function (k, v) {
                        results.push({id: v, text: v});
                    });

                    return {results: results};
                },
            }
        });

        // $reloadseo('input.reload-seo-synonyms-field').on('select2-selecting', function(e)
        // {
        //     //A new option is being selected, clear the rest.
        //     $reloadseo(this).data('select2').data([]);
        // });

        if (typeof reloadseoSnippet !== 'undefined') {

            metaTitleField = $reloadseo('.track-seo').filter(function () {
                return ($reloadseo(this).data('track-field') === 'meta_title');
            }).first();

            metaDescriptionField = $reloadseo('.track-seo').filter(function () {
                return ($reloadseo(this).data('track-field') === 'meta_description');
            }).first();

            if (metaTitleField.length <= 0 && reloadseo.meta_title !== null) {
                metaTitleField = {
                    val: function () {
                        return self.meta_title
                    },
                    length: self.meta_title.length
                };
            }

            if (metaDescriptionField.length <= 0 && reloadseo.meta_description !== null) {
                metaDescriptionField = {
                    val: function () {
                        return self.meta_description
                    },
                    length: self.meta_description.length
                };
            }

            reloadseoSnippet.init(reloadseo.vars.type);
            if (metaTitleField.length && metaDescriptionField.length) {

                var metaTitle = metaTitleField.val();
                if (reloadseo.titleSuffix.length > 0) {
                    metaTitle = metaTitle + ' ' + reloadseo.titleSuffix;
                }

                if (reloadseo.titlePrefix.length > 0) {
                    metaTitle = reloadseo.titlePrefix + ' ' + metaTitle;
                }

                reloadseoSnippet.updateSnippet(metaTitle, 'title');
                reloadseoSnippet.updateSnippet(metaDescriptionField.val(), 'description');
            }
        }

        reloadseo.updateSnippetUrl();
    },

    toggle: function () {
        if ($reloadseo('body').hasClass('hide-seo-results')) {
            $reloadseo('body').removeClass('hide-seo-results');
            $reloadseo('.seo-toggle-button').html('Hide');
            reloadseo.cookieHandler.set('showseo', 'true');
        }
        else {
            $reloadseo('body').addClass('hide-seo-results');
            $reloadseo('.seo-toggle-button').html('Show');
            reloadseo.cookieHandler.set('showseo', 'false');
        }
    },

    /**
     * collectData collects all data from the input fields.
     * @return Array
     */
    collectData: function (replaceData) {
        var customData = {};
        var data = {};
        //Loop over all fields and get the value.
        $reloadseo('.track-seo').each(function () {
            if (typeof $reloadseo(this).data('track-field') !== 'undefined') {
                data[$reloadseo(this).data('track-field')] = $reloadseo(this).val();
            }

            if (typeof replaceData !== 'undefined' && replaceData.field == $reloadseo(this).data('track-field-internal')) {
                data[$reloadseo(this).data('track-field')] = replaceData.content;
            }

            if (typeof $reloadseo(this).data('track-field-custom') !== 'undefined') {
                customData[$reloadseo(this).data('track-field-custom')] = $reloadseo(this).val();
            }
        });

        if (reloadseo.analyze_images) {
            //Collect the image urls and labels.
            var images = {};
            if (typeof media_gallery_contentJsObject !== 'undefined' && typeof media_gallery_contentJsObject.images !== 'undefined') {
                $reloadseo.each(media_gallery_contentJsObject.images, function (k, v) {
                    images[k] = {
                        url: v.url,
                        name: v.label
                    };
                });
            }
            data['images'] = images;
        }

        data['store_id'] = reloadseo.storeId;

        var visibilitySelect = $reloadseo('#visibility');
        if (visibilitySelect.length) {
            data['visibility'] = visibilitySelect.val();
        }

        data.custom = customData;

        return data;
    },

    updateSeoData: function(data) {

        if (typeof data.product !== 'undefined' && data.product !== null) {
            data = data.product;
        }

        var self = this;

        if (typeof reloadseoSnippet !== 'undefined') {

            if (data.meta_title.length > 0 && data.meta_description.length > 0) {
                var metaTitle = data.meta_title;
                var metaDescription = data.meta_description;

                if (typeof reloadseo.titleSuffix !== 'undefined' && reloadseo.titleSuffix.length > 0) {
                    metaTitle = metaTitle + ' ' + reloadseo.titleSuffix;
                }

                if (typeof reloadseo.titlePrefix !== 'undefined' && reloadseo.titlePrefix.length > 0) {
                    metaTitle = reloadseo.titlePrefix + ' ' + metaTitle;
                }

                reloadseoSnippet.updateSnippet(metaTitle, 'title');
                reloadseoSnippet.updateSnippet(metaDescription, 'description');
            }
        }

        //Changes were made, abort the current request.
        if (self.currentRequest !== null) {
            self.currentRequest.abort();
        }

        self.data = data;

        //Prepare the data in the format reload seo api wants to receive it.
        var preparedData = {};
        if (self.type != 'product') {
            preparedData['product[sku]'] = 'category-' + self.referenceId;
            self.type = 'category';
        }

        preparedData['product[product_id]'] = self.type + '-' + self.referenceId;

        for (var key in data) {
            var name = key;

            if (typeof self.fieldConversion[key] !== 'undefined' && self.fieldConversion[key] !== null) {
                name = self.fieldConversion[key];
            }

            preparedData['product[' + name + ']'] = data[key];
        }

        preparedData['stores'] = self.stores;

        self.currentRequest = $reloadseo.ajax({
            url: self.url,
            type: 'post',
            data: preparedData,
            dataType: 'json'
        }).done(function (data) {

            if (data != null && 'score' in data) {
                //Only do something when the data was valid.
                var elements = $reloadseo('.reload-seo-scores');

                elements.each(function () {
                    var element = jQuery(this);
                    //Set the basic score value and color.
                    element.find('.base-score>span.seo-score').first().text(data.score.toString());
                    element.find('.base-score>span.seo-score').first().css('background-color', data.color);

                    //Remove all current rules.
                    element.find('.seo-rules>table>tbody>tr.seo-rule').remove();
                    var tbodyElement = element.find('.seo-rules>table>tbody').first();
                    $reloadseo.each(data.rules, function (k, v) {
                        //Loop over the rules and create html rows.
                        tbodyElement.append($reloadseo("<tr class='seo-rule'><td class='indicator'><div class='indicator-dot' style='background-color: " + v.color + ";'></div></td><td>" + v.title + "</td></tr>"));
                    });
                });
            }
        });
    },

    /**
     * updateSeo makes an AJAX call to get the seo score and rules.
     * @return void
     */
    updateSeo: function (replaceData) {

        var self = this;

        self.updateSnippetUrl();

        //Collect the data and check if something changed.
        var data = self.collectData(replaceData);

        var changed = false;
        var metaChanged = false;
        $reloadseo.each(data, function (k, v) {
            if (self.data[k] != v) {
                changed = true;

                if (k == 'meta_title' || k == 'meta_description') {
                    metaChanged = true;
                }
            }
        });

        if (metaChanged) {
            if (typeof reloadseoSnippet !== 'undefined') {
                var metaTitleField = $reloadseo('.track-seo').filter(function () {
                    return ($reloadseo(this).data('track-field') === 'meta_title');
                }).first();

                var metaDescriptionField = $reloadseo('.track-seo').filter(function () {
                    return ($reloadseo(this).data('track-field') === 'meta_description');
                }).first();

                if (metaTitleField.length && metaDescriptionField.length) {
                    var metaTitle = metaTitleField.val();
                    if (reloadseo.titleSuffix.length > 0) {
                        metaTitle = metaTitle + ' ' + reloadseo.titleSuffix;
                    }

                    if (reloadseo.titlePrefix.length > 0) {
                        metaTitle = reloadseo.titlePrefix + ' ' + metaTitle;
                    }

                    reloadseoSnippet.updateSnippet(metaTitle, 'title');
                    reloadseoSnippet.updateSnippet(metaDescriptionField.val(), 'description');
                }
            }
        }

        if (changed) {
            //Changes were made, abort the current request.
            if (self.currentRequest !== null) {
                self.currentRequest.abort();
            }
            self.data = data;

            //Prepare the data in the format reload seo api wants to receive it.
            var preparedData = {};
            if (self.type != 'product') {
                preparedData['product[sku]'] = 'category-' + self.referenceId;
                self.type = 'category';
            }

            preparedData['product[product_id]'] = self.type + '-' + self.referenceId;

            for (var key in data) {
                preparedData['product[' + key + ']'] = data[key];
            }

            //if data['reload_seo_keywords']

            preparedData['stores'] = self.stores;

            //Make the AJAX request.
            self.currentRequest = $reloadseo.ajax({
                url: self.url,
                type: 'post',
                data: preparedData,
                dataType: 'json'
            }).done(function (data) {

                if (data != null && 'score' in data) {
                    //Only do something when the data was valid.
                    var elements = $reloadseo('.reload-seo-scores');

                    elements.each(function () {
                        var element = jQuery(this);
                        //Set the basic score value and color.
                        element.find('.base-score>span.seo-score').first().text(data.score.toString());
                        element.find('.base-score>span.seo-score').first().css('background-color', data.color);

                        //Remove all current rules.
                        element.find('.seo-rules>table>tbody>tr.seo-rule').remove();
                        var tbodyElement = element.find('.seo-rules>table>tbody').first();
                        $reloadseo.each(data.rules, function (k, v) {
                            //Loop over the rules and create html rows.
                            tbodyElement.append($reloadseo("<tr class='seo-rule'><td class='indicator'><div class='indicator-dot' style='background-color: " + v.color + ";'></div></td><td>" + v.title + "</td></tr>"));
                        });
                    });
                }
            });
        }
    },

    /**
     * updateSnippetUrl updates the snippet url
     *
     * @return void
     */
    updateSnippetUrl: function () {
        var snippetElement = $reloadseo('.url-snippet').first();
        if (reloadseo.type === 'product') {
            var urlKeyField = $reloadseo('.track-seo').filter(function () {
                return ($reloadseo(this).data('track-field') === 'url_key');
            }).first();
        }
        else {
            var urlKeyField = $reloadseo(".track-seo[name='general[url_key]']").first();
        }

        if (urlKeyField.length && snippetElement.length) {
            snippetElement.html(reloadseo.baseUrl + urlKeyField.val() + '<div class="action-menu"><span class="url-chevron"></span></div>');
        }
    },

    /**
     * copyResultsToWysiwyg copies the result html into the wysiwyg editor.
     *
     * @return void
     */
    copyResultsToWysiwyg: function () {
        var self = this;

        //Get the wysiwyg element.
        var wysiwyg = $reloadseo('#catalog-wysiwyg-editor');

        //Only execute when the wysiwyg does not contain the seo results yet.
        if (!wysiwyg.hasClass('contains-seo-results')) {
            //Clone the result element.
            var element = $reloadseo('#reload-seo-scores').clone();
            element.attr('id', element.attr('id') + '-wysiwyg');

            //Find the textarea in the editor.
            var textarea = wysiwyg.find('textarea').first();
            if (textarea.length) {
                //Get the container.
                var container = textarea.parents('span.field-row').first();
                if (container.length) {
                    //Append the results element to the container.
                    container.append(element);
                    container.addClass('seo-results-container');
                    //Set the class so the results won't be added twice.
                    wysiwyg.addClass('contains-seo-results');

                    //Bind the tinyMCE onChange event to update when the values changed.
                    tinyMCE.activeEditor.onChange.add(function (e) {
                        //Clear the key up timeout and update the seo directly.
                        clearTimeout(self.keyupTimer);

                        var fieldName = e.editorId.replace('_editor', '');
                        var content = e.getContent();

                        //Update the seo results and add custom content from the editor.
                        self.updateSeo({field: fieldName, content: content});
                    });

                    tinyMCE.activeEditor.onKeyUp.add(function (e) {
                        //On key up reset the timeout.
                        clearTimeout(self.keyupTimer);
                        self.keyupTimer = setTimeout(function () {
                            var fieldName = e.editorId.replace('_editor', '');
                            var content = e.getContent();

                            //When the timeout is over we want to update the seo.
                            self.updateSeo({field: fieldName, content: content});
                        }, 300);
                    });
                }
            }
        }
    },

    cookieHandler: (function () {
        var self = {};

        self.cookies = {};

        self.init = function () {
            self.cookies = {};

            var cookieString = document.cookie;
            var cookieData = cookieString.split("; ");

            if (typeof cookieData != 'undefined') {
                for (var i in cookieData) {
                    if (typeof cookieData[i] == 'string') {
                        var data = cookieData[i].split("=");
                        if (typeof data != 'undefined' && data.length == 2) {
                            self.cookies[data[0]] = data[1];
                        }
                    }
                }
            }
        };

        self.init();

        self.get = function (name) {
            if (name in this.cookies)
                return this.cookies[name];

            return null;
        };

        self.set = function (name, value) {
            document.cookie = name + '=' + value + '; expires=Fri, 31 Dec 9999 23:59:59 GMT; path=/'
            self.init();
        };

        return self;
    }(this))
};