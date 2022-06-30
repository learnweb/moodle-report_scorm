# report_scorm
## Purpose
This Plugin adds a new report functionality to scorm activities in moodle.  
It shows data on a question-level and tries to find non binary data wherever possible.  
This non binary data is displayed in violin plots allowing for a more nuanced view of the students performance than averages or means.  

## Technical Details

### Files

This section gives a quick overview of the files used in this plugin and their function. Files that are strictly related to the moodle framework such as version.php are not explained here.

* report.php  
This file is the entrypoint of the plugin. It does some validation and sanitizing of user input as well as setting the page title and url etc. It's tasks are mostly related to standard moodle setup procedures.

* classes/report.php  
This file is containing the custom class that extends the baseclass for reports \mod_score\report. It gets its data from classes/scormdata_provider and feeds it into inital mustache templates. It also calls for javascript to be injected into the page.

* classes/scormdata_provider.php  
    This is where most of the plugins work is done. This class is tasked with loading scorm data and extracting valuable information from it.

* amd/src/report_view.js  
This file gets passed the data from the scormdata_provider from classes/report and sets up the site accordingly. The javascript is also where most mustache files are being rendered and subsequently injected into the page.
In addition to this the file also sets up the click callback for the settings button.
* amd/src/modal_passgrade  
Defines a very simple modal that allows to input a number and invoke a callback when that number is submitted. It is used by amd/src/report_view to create a modal that allows for the input of a custom passing threshold for the class. 

### Data Structure

###### A quick notice on SCORM SCO terminology

Not all scos are the same there may also be 'informational' scos that do not contain any "lesson information" instead they hold metadata of the creating organization etc.
While these 'scos' are found in the scorm->sco reference table and their id is returned when querying for scos belonging to a scorm packet they do not represent a 'real' scorm packet.  
So while these are found in the sco table for an sco to hold any information about lessons it needs to have its type set to 'sco'.
