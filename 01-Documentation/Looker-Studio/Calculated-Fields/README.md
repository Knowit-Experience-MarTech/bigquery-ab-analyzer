# Looker Studio - Calculated Fields

If you need to recreate Calculated Fields, they are all described here.

## Data Source: experiments

### Calculated Fields

#### description \[Calc\]

* **Field Name:** description \[Calc\]
* **Field ID:** description_calc

**Formula:**
```javascript
REGEXP_REPLACE(description, "\\\\n", "\n")
```

#### experimente_event_value_parameter \[Calc\]

* **Field Name:** experimente_event_value_parameter \[Calc\]
* **Field ID:** experimente_event_value_parameter_calc

**Formula:**
```javascript
case
	when event_value_test then
    experiment_event_value_parameter
    else
    ''
end
```

## Data Source: experiments_report

### Parameters

#### Experiment Name Search

Create **Experiment Name Search** parameter.

* **Parameter name:** Experiment Name Search
* **Parameter ID:** experiment_name_search
* **Data Type:** Text
* **Permitted values:** Any value

### Calculated Fields

#### date_comparison \[Calc\]

* **Field Name:** date_comparison \[Calc\]
* **Field ID:** date_comparison_calc

**Formula:**
```javascript
case when date_comparison then '✔' else '' end
```

#### date_period \[Calc\]

* **Field Name:** date_period \[Calc\]
* **Field ID:** date_period_calc

**Formula:**
```javascript
concat(date_start," - ",date_end)
```

#### Experiment Name Search \[Calc\]

* **Field Name:** Experiment Name Search \[Calc\]
* **Field ID:** experiment_name_search_calc

**Formula:**
```javascript
CONTAINS_TEXT(LOWER(experiment_name), LOWER(Experiment Name Search))
```

#### Experiment Name URL \[Calc\]

Makes a **URL** based on **Experiment Name**.

The URL must be edited to match your Looker Studio URLs.

* **Field Name:** Experiment Name URL \[Calc\]
* **Field ID:** experiment_name_url_calc

**Formula:**
```javascript
hyperlink(concat("https://lookerstudio.google.com/reporting/XXX/page/p_gajqy638qd?params=%7B%22df22%22:%22include%25EE%2580%25800%25EE%2580%2580IN%25EE%2580%2580",id,"%22%7D"),experiment_name)
```
##### How to create the URL
Replace the **XXX** part of URL in the formula above with the **ID** found in YOUR Looker Studio URL.
If that doesn't work, this is how to recreate the URL from scratch:

1. Navigate to the **BigQuery A/B Analyzer Result** report
2. Copy the URL
3. Find the **id** in the URL, ex. **01**. Replace **01** with **id** as shown in the **Formula** above.

If you want to learn more about creating custom URL links with Calculated Field, here is a video about the subject:
* [https://www.youtube.com/watch?v=fGBsjgjjYWg](https://www.youtube.com/watch?v=fGBsjgjjYWg)

#### ID and Experiment Name \[Calc\]

* **Field Name:** Experiment Name Search \[Calc\]
* **Field ID:** id_experiment_name_calc

**Formula:**
```javascript
concat(id,". ",experiment_name)
```

## Data Source: experiments_images

### Calculated Fields

#### Images \[Calc\]

* **Field Name:** Images \[Calc\]
* **Field ID:** images_calc

**Formula:**
```javascript
hyperlink(image_url,IMAGE(image_url))
```
