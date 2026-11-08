# Data Studio - Calculated Fields

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

The URL must be edited to match your Data Studio URLs.

* **Field Name:** Experiment Name URL \[Calc\]
* **Field ID:** experiment_name_url_calc

**Formula:**
```javascript
hyperlink(concat("https://datastudio.google.com/reporting/XXX/page/p_gajqy638qd?params=%7B%22df22%22:%22include%25EE%2580%25800%25EE%2580%2580IN%25EE%2580%2580",id,"%22%7D"),experiment_name)
```
##### How to create the URL
Replace the **XXX** part of URL in the formula above with the **ID** found in YOUR Data Studio URL.
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

#### Conversion Likely Range \[Calc\]

The likely range (confidence interval) of the conversion lift, e.g. **+4.4% to +9.8%**. Empty when the range can't be calculated.

* **Field Name:** Conversion Likely Range \[Calc\]
* **Field ID:** conv_likely_range_calc

**Formula:**
```javascript
CASE
  WHEN conv_lift_ci_low IS NULL THEN NULL
  ELSE CONCAT(
    CASE WHEN conv_lift_ci_low > 0 THEN "+" ELSE "" END,
    CAST(ROUND(conv_lift_ci_low * 100, 1) AS TEXT), "% to ",
    CASE WHEN conv_lift_ci_high > 0 THEN "+" ELSE "" END,
    CAST(ROUND(conv_lift_ci_high * 100, 1) AS TEXT), "%"
  )
END
```

#### Value Likely Range \[Calc\]

The likely range (confidence interval) of the value lift. Empty when no value test is run.

* **Field Name:** Value Likely Range \[Calc\]
* **Field ID:** value_likely_range_calc

**Formula:**
```javascript
CASE
  WHEN value_lift_ci_low IS NULL THEN NULL
  ELSE CONCAT(
    CASE WHEN value_lift_ci_low > 0 THEN "+" ELSE "" END,
    CAST(ROUND(value_lift_ci_low * 100, 1) AS TEXT), "% to ",
    CASE WHEN value_lift_ci_high > 0 THEN "+" ELSE "" END,
    CAST(ROUND(value_lift_ci_high * 100, 1) AS TEXT), "%"
  )
END
```

#### Value per Conversion \[Calc\]

Value per conversion (average order value). Value per participant includes participants without a conversion, and this field shows the value of the conversions only.

* **Field Name:** Value per Conversion \[Calc\]
* **Field ID:** value_per_conversion_calc

**Formula:**
```javascript
CASE
  WHEN variant = "A" AND conversion_a > 0 THEN total_conversion_value_a / conversion_a
  WHEN variant = "B" AND conversion_b > 0 THEN total_conversion_value_b / conversion_b
  ELSE NULL
END
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
