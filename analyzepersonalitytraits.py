import firebase_admin
from firebase_admin import credentials, firestore
import statistics
import json
from typing import Dict


def analyze_personality_distributions():
    """
    Analyze the distribution of personality trait scores across all users.
    Outputs comprehensive statistics and saves results to a JSON file.
    """
    # Initialize Firebase
    cred = credentials.Certificate(r"C:\Users\Reece\PycharmProjects\FounderMatchaV2\firebase-credentials.json")
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    db = firestore.client()

    # Initialize data structures
    trait_stats = {
        'openness': {'values': []},
        'conscientiousness': {'values': []},
        'extraversion': {'values': []},
        'agreeableness': {'values': []},
        'neuroticism': {'values': []}
    }

    # Collect data by role
    role_stats = {
        'founder': {trait: {'values': []} for trait in trait_stats},
        'developer': {trait: {'values': []} for trait in trait_stats}
    }

    # Fetch and process data
    users = db.collection('hackathonusers').get()
    for user in users:
        data = user.to_dict()
        if 'personalityResults' not in data:
            continue

        # Get role
        role = 'founder' if data.get('role') == 'founder / entrepreneur' else 'developer'

        # Process each trait
        for trait in trait_stats:
            if trait in data['personalityResults']:
                value = data['personalityResults'][trait]
                trait_stats[trait]['values'].append(value)
                role_stats[role][trait]['values'].append(value)

    # Calculate statistics for each trait
    results = {
        'overall': {},
        'by_role': {
            'founder': {},
            'developer': {}
        }
    }

    # Helper function to calculate statistics
    def calc_stats(values):
        if not values:
            return None
        return {
            'min': min(values),
            'max': max(values),
            'mean': statistics.mean(values),
            'median': statistics.median(values),
            'stdev': statistics.stdev(values) if len(values) > 1 else 0,
            'count': len(values),
            'quartiles': {
                'q1': statistics.quantiles(values, n=4)[0],
                'q2': statistics.quantiles(values, n=4)[1],
                'q3': statistics.quantiles(values, n=4)[2]
            }
        }

    # Calculate overall statistics
    for trait in trait_stats:
        results['overall'][trait] = calc_stats(trait_stats[trait]['values'])

    # Calculate role-specific statistics
    for role in role_stats:
        for trait in trait_stats:
            results['by_role'][role][trait] = calc_stats(role_stats[role][trait]['values'])

    # Print summary
    print("\nPersonality Trait Analysis Summary:")
    print("==================================")

    for trait in trait_stats:
        print(f"\n{trait.upper()}")
        print("-" * len(trait))

        overall_stats = results['overall'][trait]
        print(f"Overall Range: {overall_stats['min']} to {overall_stats['max']}")
        print(f"Mean: {overall_stats['mean']:.2f}")
        print(f"Standard Deviation: {overall_stats['stdev']:.2f}")
        print(f"Sample Size: {overall_stats['count']}")

        print("\nBy Role:")
        for role in ['founder', 'developer']:
            role_stat = results['by_role'][role][trait]
            if role_stat:
                print(f"{role.capitalize()}:")
                print(f"  Range: {role_stat['min']} to {role_stat['max']}")
                print(f"  Mean: {role_stat['mean']:.2f}")
                print(f"  Sample Size: {role_stat['count']}")

    # Save detailed results to JSON
    with open('personality_analysis.json', 'w') as f:
        json.dump(results, f, indent=2)

    print("\nDetailed results have been saved to 'personality_analysis.json'")
    return results


if __name__ == "__main__":
    analyze_personality_distributions()