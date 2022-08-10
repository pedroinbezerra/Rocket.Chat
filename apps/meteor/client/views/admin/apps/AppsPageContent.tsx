import { App, AppOverview } from '@rocket.chat/core-typings';
import {
	Box,
	States,
	StatesAction,
	StatesActions,
	StatesIcon,
	StatesSubtitle,
	StatesSuggestion,
	StatesSuggestionList,
	StatesSuggestionListItem,
	StatesSuggestionText,
	StatesTitle,
	Icon,
	Pagination,
	Skeleton,
} from '@rocket.chat/fuselage';
import { useDebouncedState } from '@rocket.chat/fuselage-hooks';
import colors from '@rocket.chat/fuselage-tokens/colors';
import { useRoute, useTranslation } from '@rocket.chat/ui-contexts';
import React, { FC, useMemo, useState } from 'react';

import { usePagination } from '../../../components/GenericTable/hooks/usePagination';
import { useEndpointData } from '../../../hooks/useEndpointData';
import { AsyncStatePhase } from '../../../lib/asyncState';
import { useAppsReload, useAppsResult } from './AppsContext';
import AppsFilters from './AppsFilters';
import AppsList from './AppsList';
import { RadioDropDownGroup } from './definitions/RadioDropDownDefinitions';
import { useCategories } from './hooks/useCategories';
import { useFilteredApps } from './hooks/useFilteredApps';
import { useRadioToggle } from './hooks/useRadioToggle';

const AppsPageContent: FC<{
	isMarketplace: boolean;
}> = ({ isMarketplace }) => {
	const t = useTranslation();
	const { marketplaceApps, installedApps } = useAppsResult();
	const [text, setText] = useDebouncedState('', 500);
	const reload = useAppsReload();
	const { current, itemsPerPage, setItemsPerPage: onSetItemsPerPage, setCurrent: onSetCurrent, ...paginationProps } = usePagination();

	const marketplaceRoute = useRoute('admin-marketplace');

	const [freePaidFilterStructure, setFreePaidFilterStructure] = useState({
		label: t('Filter_By_Price'),
		items: [
			{ id: 'all', label: t('All_Prices'), checked: true },
			{ id: 'free', label: t('Free_Apps'), checked: false },
			{ id: 'paid', label: t('Paid_Apps'), checked: false },
		],
	});
	const freePaidFilterOnSelected = useRadioToggle(setFreePaidFilterStructure);

	const [statusFilterStructure, setStatusFilterStructure] = useState({
		label: t('Filter_By_Status'),
		items: [
			{ id: 'all', label: t('All_status'), checked: true },
			{ id: 'enabled', label: t('Enabled'), checked: false },
			{ id: 'disabled', label: t('Disabled'), checked: false },
		],
	});
	const statusFilterOnSelected = useRadioToggle(setStatusFilterStructure);

	const [sortFilterStructure, setSortFilterStructure] = useState<RadioDropDownGroup>({
		label: t('Sort_By'),
		items: [
			{ id: 'az', label: 'A-Z', checked: true },
			{ id: 'za', label: 'Z-A', checked: false },
			{ id: 'mru', label: t('Most_recent_updated'), checked: false },
			{ id: 'lru', label: t('Least_recent_updated'), checked: false },
		],
	});
	const sortFilterOnSelected = useRadioToggle(setSortFilterStructure);

	const [categories, selectedCategories, categoryTagList, onSelected] = useCategories();
	const appsResult = useFilteredApps({
		appsData: isMarketplace ? marketplaceApps : installedApps,
		text,
		current,
		itemsPerPage,
		categories: useMemo(() => selectedCategories.map(({ label }) => label), [selectedCategories]),
		purchaseType: useMemo(() => freePaidFilterStructure.items.find(({ checked }) => checked)?.id, [freePaidFilterStructure]),
		sortingMethod: useMemo(() => sortFilterStructure.items.find(({ checked }) => checked)?.id, [sortFilterStructure]),
		status: useMemo(() => statusFilterStructure.items.find(({ checked }) => checked)?.id, [statusFilterStructure]),
	});

	const isAllAppsListReadyOrLoading =
		appsResult.phase === AsyncStatePhase.LOADING || (appsResult.phase === AsyncStatePhase.RESOLVED && Boolean(appsResult.value.count));

	const noInstalledAppsFound = appsResult.phase === AsyncStatePhase.RESOLVED && !isMarketplace && appsResult.value.total === 0;

	const noMarketplaceOrInstalledAppMatches = appsResult.phase === AsyncStatePhase.RESOLVED && isMarketplace && appsResult.value.count === 0;

	const noInstalledAppMatches =
		appsResult.phase === AsyncStatePhase.RESOLVED && !isMarketplace && appsResult.value.total !== 0 && appsResult.value.count === 0;

	const loadingRows = Array.from({ length: 8 }, (_, i) => <Skeleton key={i} height='x56' mbe='x8' width='100%' variant='rect' />);

	const { value: featuredResponse } = useEndpointData('/apps/featured');

	const normalizeFeaturedApps = (appOverviewList: AppOverview[]): App[] =>
		appOverviewList.map((appOverview) => {
			const { latest, ...rest } = appOverview;

			return { ...latest, ...rest };
		});

	return (
		<>
			<AppsFilters
				setText={setText}
				freePaidFilterStructure={freePaidFilterStructure}
				freePaidFilterOnSelected={freePaidFilterOnSelected}
				categories={categories}
				selectedCategories={selectedCategories}
				onSelected={onSelected}
				sortFilterStructure={sortFilterStructure}
				sortFilterOnSelected={sortFilterOnSelected}
				categoryTagList={categoryTagList}
				statusFilterStructure={statusFilterStructure}
				statusFilterOnSelected={statusFilterOnSelected}
			/>

			{featuredResponse?.sections.map((section) => (
				<AppsList apps={normalizeFeaturedApps(section.apps)} title={section.i18nLabel} isMarketplace={true} mbe='x36' />
			))}

			{isAllAppsListReadyOrLoading && appsResult.phase === AsyncStatePhase.LOADING
				? loadingRows
				: appsResult.phase === AsyncStatePhase.RESOLVED && (
						<AppsList apps={appsResult.value.items} title={t('All_Apps')} isMarketplace={isMarketplace} />
				  )}

			{appsResult.phase === AsyncStatePhase.RESOLVED && (
				<Pagination
					current={current}
					itemsPerPage={itemsPerPage}
					count={appsResult.value.total}
					onSetItemsPerPage={onSetItemsPerPage}
					onSetCurrent={onSetCurrent}
					borderBlockStart={`2px solid ${colors.n300}`}
					{...paginationProps}
				/>
			)}

			{noMarketplaceOrInstalledAppMatches && (
				<Box mbs='x20'>
					<States>
						<StatesIcon name='magnifier' />
						<StatesTitle>{t('No_app_matches')}</StatesTitle>
						{appsResult?.value?.shouldShowSearchText ? (
							<StatesSubtitle>
								{t('No_marketplace_matches_for')}: <strong>"{text}"</strong>
							</StatesSubtitle>
						) : (
							''
						)}
						<StatesSuggestion>
							<StatesSuggestionText>{t('You_can_try_to')}:</StatesSuggestionText>
							<StatesSuggestionList>
								<StatesSuggestionListItem>{t('Search_by_category')}</StatesSuggestionListItem>
								<StatesSuggestionListItem>{t('Search_for_a_more_general_term')}</StatesSuggestionListItem>
								<StatesSuggestionListItem>{t('Search_for_a_more_specific_term')}</StatesSuggestionListItem>
								<StatesSuggestionListItem>{t('Check_if_the_spelling_is_correct')}</StatesSuggestionListItem>
							</StatesSuggestionList>
						</StatesSuggestion>
					</States>
				</Box>
			)}

			{noInstalledAppMatches && (
				<Box mbs='x20'>
					<States>
						<StatesIcon name='magnifier' />
						<StatesTitle>{t('No_installed_app_matches')}</StatesTitle>
						{appsResult?.value?.shouldShowSearchText ? (
							<StatesSubtitle>
								<span>
									{t('No_app_matches_for')} <strong>"{text}"</strong>
								</span>
							</StatesSubtitle>
						) : (
							''
						)}
						<StatesSuggestion>
							<StatesSuggestionText>{t('Try_searching_in_the_marketplace_instead')}</StatesSuggestionText>
						</StatesSuggestion>
						<StatesActions>
							<StatesAction onClick={(): void => marketplaceRoute.push({ context: '' })}>{t('Search_on_marketplace')}</StatesAction>
						</StatesActions>
					</States>
				</Box>
			)}

			{noInstalledAppsFound && (
				<Box mbs='x20'>
					<States>
						<StatesIcon name='magnifier' />
						<StatesTitle>{t('No_apps_installed')}</StatesTitle>
						<StatesSubtitle>{t('Explore_the_marketplace_to_find_awesome_apps')}</StatesSubtitle>
						<StatesActions>
							<StatesAction onClick={(): void => marketplaceRoute.push({ context: '' })}>{t('Explore_marketplace')}</StatesAction>
						</StatesActions>
					</States>
				</Box>
			)}

			{appsResult.phase === AsyncStatePhase.REJECTED && (
				<Box mbs='x20'>
					<States>
						<StatesIcon variation='danger' name='circle-exclamation' />
						<StatesTitle>{t('Connection_error')}</StatesTitle>
						<StatesSubtitle>{t('Marketplace_error')}</StatesSubtitle>
						<StatesActions>
							<StatesAction onClick={reload}>
								<Icon mie='x4' size='x20' name='reload' />
								{t('Reload_page')}
							</StatesAction>
						</StatesActions>
					</States>
				</Box>
			)}
		</>
	);
};

export default AppsPageContent;
