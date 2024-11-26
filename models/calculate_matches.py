# calculate_matches.py
import firebase_admin
from firebase_admin import credentials, firestore
from typing import List, Dict, Tuple, Set
from pathlib import Path
import json

class EnhancedMatcher:
    def __init__(
            self,
            cred_path: str,
            weights: Dict = None
    ):
        if not firebase_admin._apps:
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        self.db = firestore.client()

        self.component_weights = {
            'core_match': 0.90, # Skills and personality
            'background_match': 0.05, # Education and industry
            'cultural_match': 0.05, # Values and interests
        }

        self.core_weights = {
            'skills': 0.40, # Skill weighting
            'personality': 0.60 # Personality weighting
        }

        self.skill_weights = {
            'primary': 0.75, # Each industry has a set of primary skills
            'secondary': 0.25 # And secondary skills
        }

        self.background_weights = {
            'education': 0.50, # Education weighting
            'industry': 0.50 # Indsutry weighting
        }

        self.cultural_weights = {
            'values': 0.50, # If any of the admiring personalities overlap
            'interests': 0.50 # If any hobbies overlap
        }

        # New personality matching weights
        self.personality_trait_weights = {
            'core_traits': 0.50,  # Weight for base trait matching
            'red_flags': 0.35,  # Weight for red flags
            'positive_signals': 0.15  # Weight for positive signals
        }

        # Red flag severity weights
        self.red_flag_weights = {
            'high_neuroticism': 0.60,  # Multiplier when combined neuroticism > 30
            'low_conscientiousness': 0.50,  # Multiplier when developer conscientiousness < 5
            'extraversion_gap': 0.70,  # Multiplier when extraversion difference > 15
            'low_agreeableness': 0.60  # Multiplier when both have low agreeableness
        }

        # Positive signal boost weights
        self.positive_signal_weights = {
            'conscientiousness_balance': 1.10,  # Multiplier when developer >= founder
            'high_agreeableness': 1.08,  # Multiplier when combined > 15
            'high_openness': 1.08,  # Multiplier when max > 15
            'low_neuroticism': 1.08  # Multiplier when combined < 25
        }

        # Context boost weights
        self.context_boost_weights = {
            'admired_personality_overlap': 1.10,  # Multiplier for shared admired personalities
            'activity_level_match': 1.05  # Multiplier for matching activity levels
        }

        # Original personality trait weights (for core trait calculations)
        self.personality_weights = {
            'openness': 0.25,
            'conscientiousness': 0.25,
            'extraversion': 0.15,
            'agreeableness': 0.20,
            'neuroticism': 0.15
        }

        # Load industry mappings from JSON
        try:
            json_path = Path(__file__).parent / 'industries.json'
            with open(json_path, 'r') as f:
                industry_data = json.load(f)
                self.industry_skills_map = industry_data['industries.json']['mappings']
                self.industry_aliases = industry_data['industries.json']['aliases']
        except Exception as e:
            print(f"Error loading industry mappings: {e}")
            # Fallback to default empty mappings
            self.industry_skills_map = {}
            self.industry_aliases = {}

        self.default_skills = {
            'primary': {'Full-Stack', 'Back-End', 'Front-End'},
            'secondary': {'Cloud', 'DevOps', 'UI/UX'}
        }

        self.industry_aliases = {
            'GreenTech': 'CleanTech',
            'Green Tech': 'CleanTech',
            'Green Technology': 'CleanTech'
        }

    def _update_nested_dict(self, d: Dict, u: Dict) -> Dict:
        for k, v in u.items():
            if isinstance(v, dict) and k in d and isinstance(d[k], dict):
                self._update_nested_dict(d[k], v)
            else:
                d[k] = v
        return d

    def extract_working_field(self, about: str, long_description: str) -> str:
        text = f"{about or ''} {long_description or ''}"

        for industry in self.industry_skills_map.keys():
            search_terms = industry.replace('/', ' ').split()
            if all(term.lower() in text.lower() for term in search_terms):
                return industry

        for alias, industry in self.industry_aliases.items():
            if alias.lower() in text.lower():
                return industry

        return None

    def calculate_skill_match(self, founder: Dict, developer: Dict) -> float:
        """
        Calculate skill match between founder and developer with stricter criteria.
        Returns a float between 0 and 1.
        """
        # Constants for scoring
        MIN_PRIMARY_COVERAGE = 0.70  # Must have 70% of primary skills
        MAX_TECH_BONUS = 0.15  # Cap the bonus for extra skills
        TECH_BONUS_PER_SKILL = 0.01  # Reduced bonus per additional skill
        MIN_SCORE = 0.30  # Minimum score if any relevant skills present

        working_field = self.extract_working_field(
            founder.get('about', ''),
            founder.get('longDescription', '')
        )

        if not working_field:
            return 0.0

        dev_skills = set(developer.get('skills', []))
        if not dev_skills:
            return 0.0

        # Get required skills from industry mappings
        if working_field in self.industry_skills_map:
            primary_skills = set(self.industry_skills_map[working_field]['primary'])
            secondary_skills = set(self.industry_skills_map[working_field]['secondary'])
        else:
            primary_skills = set(self.default_skills['primary'])
            secondary_skills = set(self.default_skills['secondary'])

        # Calculate coverage percentages
        primary_matches = primary_skills.intersection(dev_skills)
        secondary_matches = secondary_skills.intersection(dev_skills)

        primary_coverage = len(primary_matches) / len(primary_skills) if primary_skills else 0
        secondary_coverage = len(secondary_matches) / len(secondary_skills) if secondary_skills else 0

        # Calculate base score with weighted coverage
        base_score = (
                primary_coverage * self.skill_weights['primary'] +
                secondary_coverage * self.skill_weights['secondary']
        )

        # Apply minimum threshold penalty for primary skills
        if primary_coverage < MIN_PRIMARY_COVERAGE:
            base_score *= 0.5

        # Calculate tech bonus with diminishing returns
        tech_skills = dev_skills - (primary_skills.union(secondary_skills))
        tech_bonus = min(len(tech_skills) * TECH_BONUS_PER_SKILL, MAX_TECH_BONUS)

        # Calculate final score
        final_score = base_score + tech_bonus

        # Apply minimum score if there's any relevant skill match
        if primary_matches or secondary_matches:
            final_score = max(MIN_SCORE, final_score)

        return min(0.95, final_score)  # Cap at 95% to make perfect scores rare

    def calculate_personality_match(self, founder: Dict, developer: Dict) -> float:
        founder_personality = founder.get('personalityResults', {})
        developer_personality = developer.get('personalityResults', {})

        if not founder_personality or not developer_personality:
            return 0.0

        scores = {}

        # Openness: Range -2 to 25, Mean ~12.7
        f_openness = founder_personality.get('openness', 0)
        d_openness = developer_personality.get('openness', 0)
        # Reward above average scores (>12)
        scores['openness'] = min(1.0, ((f_openness + d_openness) / 50))

        # Conscientiousness: Range -2 to 25, Mean ~12.6
        f_conscientiousness = founder_personality.get('conscientiousness', 0)
        d_conscientiousness = developer_personality.get('conscientiousness', 0)
        # Want developer above average (>12)
        scores['conscientiousness'] = min(1.0, (d_conscientiousness + 2) / 27)
        if d_conscientiousness < 10:  # Below average is concerning
            scores['conscientiousness'] *= 0.7

        # Extraversion: Range -3 to 25, Mean ~11.8
        f_extraversion = founder_personality.get('extraversion', 0)
        d_extraversion = developer_personality.get('extraversion', 0)
        # Prefer complementary scores but not extreme gaps
        gap = abs(f_extraversion - d_extraversion)
        scores['extraversion'] = min(1.0, 1 - (gap / 28))

        # Agreeableness: Range -2 to 25, Mean ~12.2
        f_agreeableness = founder_personality.get('agreeableness', 0)
        d_agreeableness = developer_personality.get('agreeableness', 0)
        # Want at least one above average (>12)
        scores['agreeableness'] = min(1.0, max(f_agreeableness, d_agreeableness) / 25)

        # Neuroticism: Range 5 to 83, Mean ~22.8
        f_neuroticism = founder_personality.get('neuroticism', 0)
        d_neuroticism = developer_personality.get('neuroticism', 0)
        # Prefer lower scores, heavily penalize high scores
        if d_neuroticism > 40:  # Well above mean
            scores['neuroticism'] = 0.3
        elif d_neuroticism > 30:  # Above mean
            scores['neuroticism'] = 0.5
        else:
            scores['neuroticism'] = min(1.0, 1 - (d_neuroticism / 50))

        # Adjusted weights based on importance
        weights = {
            'openness': 0.20,
            'conscientiousness': 0.25,
            'extraversion': 0.15,
            'agreeableness': 0.20,
            'neuroticism': 0.20
        }

        base_score = sum(scores[trait] * weights[trait] for trait in scores)

        # Red flags based on statistical distribution
        red_flags = 1.0

        if d_neuroticism > 50:  # Very high neuroticism (>2 SD above mean)
            red_flags *= 0.6
        if d_conscientiousness < 5:  # Very low conscientiousness (>1 SD below mean)
            red_flags *= 0.7
        if f_agreeableness < 0 and d_agreeableness < 0:  # Both negative agreeableness
            red_flags *= 0.8
        if f_openness < 5 and d_openness < 5:  # Both low openness
            red_flags *= 0.8

        final_score = base_score * red_flags

        return min(0.90, final_score)  # Cap at 90% to make perfect matches rare

    def calculate_background_match(self, founder: Dict, developer: Dict) -> float:
        founder_degrees = set(' '.join(founder.get('degrees', [])).lower().split())
        developer_degrees = set(' '.join(developer.get('degrees', [])).lower().split())

        technical_fields = {'engineering', 'computer', 'data', 'statistics', 'mathematics', 'robotics'}
        business_fields = {'business', 'management', 'mba', 'economics', 'finance'}

        founder_technical = any(field in ' '.join(founder_degrees) for field in technical_fields)
        founder_business = any(field in ' '.join(founder_degrees) for field in business_fields)
        developer_technical = any(field in ' '.join(developer_degrees) for field in technical_fields)

        education_score = 1.0 if (founder_business and developer_technical) or (
                    founder_technical and developer_technical) else 0.6

        founder_industries = set(founder.get('industries', []))
        developer_industries = set(developer.get('industries', []))
        industry_overlap = len(founder_industries.intersection(developer_industries)) / max(
            len(founder_industries | developer_industries), 1)

        return (education_score * self.background_weights['education'] +
                industry_overlap * self.background_weights['industry'])

    def calculate_cultural_match(self, founder: Dict, developer: Dict) -> float:
        founder_companies = set(founder.get('companies', []))
        developer_companies = set(developer.get('companies', []))
        company_overlap = len(founder_companies.intersection(developer_companies)) / max(
            len(founder_companies | developer_companies), 1)

        founder_personalities = set(founder.get('admiringpersonalities', []))
        developer_personalities = set(developer.get('admiringpersonalities', []))
        personality_overlap = len(founder_personalities.intersection(developer_personalities)) / max(
            len(founder_personalities | developer_personalities), 1)

        values_score = (company_overlap + personality_overlap) / 2

        founder_hobbies = set(founder.get('hobbies', []))
        developer_hobbies = set(developer.get('hobbies', []))

        founder_hobbies = {hobby.lower() for hobby in founder_hobbies}
        developer_hobbies = {hobby.lower() for hobby in developer_hobbies}

        hobby_overlap = len(founder_hobbies.intersection(developer_hobbies)) / max(
            len(founder_hobbies | developer_hobbies), 1)

        active_hobbies = {'climbing', 'hiking', 'biking', 'surfing', 'martial', 'sports'}
        founder_active = any(any(active in hobby for active in active_hobbies) for hobby in founder_hobbies)
        developer_active = any(any(active in hobby for active in active_hobbies) for hobby in developer_hobbies)

        interests_score = min(1.0, hobby_overlap + (0.2 if founder_active and developer_active else 0))

        return (values_score * self.cultural_weights['values'] +
                interests_score * self.cultural_weights['interests'])

    def calculate_match_score(self, founder: Dict, developer: Dict) -> Dict:
        skill_score = self.calculate_skill_match(founder, developer)
        personality_score = self.calculate_personality_match(founder, developer)
        core_score = (skill_score * self.core_weights['skills'] +
                      personality_score * self.core_weights['personality'])

        background_score = self.calculate_background_match(founder, developer)
        cultural_score = self.calculate_cultural_match(founder, developer)

        total_score = (
                core_score * self.component_weights['core_match'] +
                background_score * self.component_weights['background_match'] +
                cultural_score * self.component_weights['cultural_match']
        )

        return {
            'total_score': round(total_score * 100, 2),
            'components': {
                'core_score': round(core_score * 100, 2),
                'skill_score': round(skill_score * 100, 2),
                'personality_score': round(personality_score * 100, 2),
                'background_score': round(background_score * 100, 2),
                'cultural_score': round(cultural_score * 100, 2)
            }
        }

    def find_matches(self, founder: Dict, developers: List[Dict], min_score: float = 30.0) -> List[Tuple[Dict, Dict]]:
        matches = []

        working_field = self.extract_working_field(
            founder.get('about', ''),
            founder.get('longDescription', '')
        )

        if working_field in self.industry_skills_map:
            primary_skills = self.industry_skills_map[working_field]['primary']
            secondary_skills = self.industry_skills_map[working_field]['secondary']
        else:
            primary_skills = self.default_skills['primary']
            secondary_skills = self.default_skills['secondary']

        print(f"\nRequired skills for {working_field}:")
        print(f"Primary ({self.skill_weights['primary'] * 100}% weight): {', '.join(primary_skills)}")
        print(f"Secondary ({self.skill_weights['secondary'] * 100}% weight): {', '.join(secondary_skills)}")

        for developer in developers:
            match_results = self.calculate_match_score(founder, developer)
            if match_results['total_score'] >= min_score:
                matches.append((developer, match_results))

        matches.sort(key=lambda x: x[1]['total_score'], reverse=True)
        return matches

def main():
    cred_path = "../firebase-credentials.json"
    matcher = EnhancedMatcher(cred_path)

    users = matcher.db.collection('hackathonusers').get()
    founders = []
    developers = []

    for user in users:
        data = user.to_dict()
        if data['role'] == 'founder / entrepreneur':
            founders.append(data)
        elif data['role'] == 'softwareEngineer':
            developers.append(data)

    if founders and developers:
        founder = founders[0]
        print(f"\nFinding matches for founder: {founder['name']}")

        matches = matcher.find_matches(founder, developers)
        print("\nTop Matches:")
        for dev, match_results in matches:
            print(f"\nDeveloper: {dev['name']}")
            print(f"Skills: {', '.join(dev.get('skills', []))}")
            print(f"Total Score: {match_results['total_score']}%")
            print("Component Scores:")
            print(f"- Core Score: {match_results['components']['core_score']}%")
            print(f"  • Skill Match: {match_results['components']['skill_score']}%")
            print(f"  • Personality Match: {match_results['components']['personality_score']}%")
            print(f"- Background Score: {match_results['components']['background_score']}%")
            print(f"- Cultural Score: {match_results['components']['cultural_score']}%")


if __name__ == "__main__":
    main()