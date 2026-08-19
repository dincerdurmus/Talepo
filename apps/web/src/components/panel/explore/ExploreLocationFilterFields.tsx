"use client";

import { useMemo, useState } from "react";

import { ExploreLocationMultiSelect } from "@/components/panel/explore/ExploreLocationMultiSelect";
import {
  exploreDistrictChoices,
  parseExploreLocationList,
  pruneExploreDistricts,
} from "@/lib/explore/location-filter";
import { TURKEY_IL_NAMES } from "@/lib/geo/turkey-districts";

const CITY_OPTIONS = TURKEY_IL_NAMES.map((il) => ({ value: il, label: il }));

function locationStateFromParams(citiesRaw: string, districtsRaw: string) {
  const cities = parseExploreLocationList(citiesRaw);
  return {
    cities,
    districts: pruneExploreDistricts(
      cities,
      parseExploreLocationList(districtsRaw),
    ),
  };
}

export function ExploreLocationFilterFields({
  initialCities = "",
  initialDistricts = "",
}: {
  initialCities?: string;
  initialDistricts?: string;
}) {
  const [cities, setCities] = useState(
    () => locationStateFromParams(initialCities, initialDistricts).cities,
  );
  const [districts, setDistricts] = useState(
    () => locationStateFromParams(initialCities, initialDistricts).districts,
  );

  const districtOptions = useMemo(
    () => exploreDistrictChoices(cities),
    [cities],
  );

  function handleCitiesChange(next: string[]) {
    setCities(next);
    setDistricts((current) =>
      next.length === 0 ? [] : pruneExploreDistricts(next, current),
    );
  }

  return (
    <>
      <ExploreLocationMultiSelect
        label="Şehir"
        name="city"
        values={cities}
        options={CITY_OPTIONS}
        allLabel="Tümü"
        searchPlaceholder="İl ara"
        onChange={handleCitiesChange}
      />
      {cities.length > 0 ? (
        <ExploreLocationMultiSelect
          label="İlçe"
          name="district"
          values={districts}
          options={districtOptions}
          allLabel="Tümü"
          searchPlaceholder="İlçe ara"
          onChange={setDistricts}
        />
      ) : null}
    </>
  );
}
