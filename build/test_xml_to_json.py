import json
import os
import pytest
from helpers import normalise, get_letter


class TestNormalise:
    def test_lowercase(self):
        assert normalise('AIMER') == 'aimer'

    def test_trim(self):
        assert normalise('  aimer  ') == 'aimer'

    def test_strip_accents(self):
        assert normalise('élément') == 'element'
        assert normalise('êtes') == 'etes'
        assert normalise('à') == 'a'

    def test_mixed_case_accents(self):
        assert normalise('ÉLÉMENT') == 'element'

    def test_plain_ascii(self):
        assert normalise('maison') == 'maison'

    def test_empty_string(self):
        assert normalise('') == ''

    def test_hyphenated(self):
        assert normalise('AVANT-GARDE') == 'avant-garde'

    def test_cedilla(self):
        assert normalise('français') == 'francais'

    def test_diaeresis(self):
        assert normalise('naïf') == 'naif'


class TestGetLetter:
    def test_plain_letter(self):
        assert get_letter('maison') == 'M'

    def test_ae_fold_to_a(self):
        assert get_letter('aile') == 'A'

    def test_o_stays_o(self):
        assert get_letter('ordre') == 'O'

    def test_oefold_to_o(self):
        assert get_letter('oeuvre') == 'O'

    def test_empty_returns_a(self):
        assert get_letter('') == 'A'

    def test_accented_a(self):
        assert get_letter('âge') == 'A'

    def test_accented_e(self):
        assert get_letter('eau') == 'E'

    def test_accented_é(self):
        assert get_letter('état') == 'E'

    def test_uppercase_input(self):
        assert get_letter('BONHEUR') == 'B'


class TestXmlToJsonPipeline:
    def test_index_json_structure(self):
        index_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'index.json')
        if not os.path.exists(index_path):
            pytest.skip('No index.json available (run build:data first)')

        with open(index_path, 'r', encoding='utf-8') as f:
            index = json.load(f)

        assert isinstance(index, dict)
        assert '__version__' in index
        assert isinstance(index['__version__'], str)
        for letter, words in index.items():
            if letter == '__version__':
                continue
            assert isinstance(letter, str)
            assert len(letter) == 1
            assert 'A' <= letter <= 'Z'
            assert isinstance(words, list)
            assert len(words) > 0
            for w in words:
                assert w == w.upper()

    def test_letter_files_match_index(self):
        data_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'data')
        index_path = os.path.join(data_dir, 'index.json')
        if not os.path.exists(index_path):
            pytest.skip('No index.json available')

        with open(index_path, 'r', encoding='utf-8') as f:
            index = json.load(f)

        for letter in index:
            if letter == '__version__':
                continue
            letter_file = os.path.join(data_dir, f'{letter}.json')
            assert os.path.exists(letter_file), f'Missing {letter}.json'

            with open(letter_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            assert isinstance(data, dict)
            for key, entry in data.items():
                assert 'mot' in entry
                assert 'sens' in entry
                assert isinstance(entry['sens'], list)
                assert len(entry['sens']) > 0
                for sens in entry['sens']:
                    assert 'html' in sens
                    assert 'entete' in sens
                    assert 'mot' in sens

    def test_meanings_have_valid_structure(self):
        data_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'data')
        index_path = os.path.join(data_dir, 'index.json')
        if not os.path.exists(index_path):
            pytest.skip('No index.json available')

        with open(index_path, 'r', encoding='utf-8') as f:
            index = json.load(f)

        total_meanings = 0
        for letter in index:
            if letter == '__version__':
                continue
            letter_file = os.path.join(data_dir, f'{letter}.json')
            if not os.path.exists(letter_file):
                continue

            with open(letter_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            for key, entry in data.items():
                for sens in entry['sens']:
                    total_meanings += 1
                    assert isinstance(sens.get('mot'), str) and len(sens['mot']) > 0
                    assert isinstance(sens.get('html'), str)
                    assert isinstance(sens.get('entete'), str)
                    assert sens.get('num') is None or isinstance(sens['num'], str)

        assert total_meanings > 0

    def test_multi_meaning_entries_exist(self):
        data_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'data')
        index_path = os.path.join(data_dir, 'index.json')
        if not os.path.exists(index_path):
            pytest.skip('No index.json available')

        with open(index_path, 'r', encoding='utf-8') as f:
            index = json.load(f)

        multi_sens_found = False
        for letter in index:
            if letter == '__version__':
                continue
            letter_file = os.path.join(data_dir, f'{letter}.json')
            if not os.path.exists(letter_file):
                continue

            with open(letter_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            for key, entry in data.items():
                if len(entry['sens']) > 1:
                    multi_sens_found = True
                    break
            if multi_sens_found:
                break

        assert multi_sens_found, 'No multi-sens entries found'

    def test_merged_meanings_have_correct_mots(self):
        data_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'data')
        letter_file = os.path.join(data_dir, 'A.json')
        if not os.path.exists(letter_file):
            pytest.skip('No A.json available')

        with open(letter_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        a_entry = data.get('a')
        assert a_entry is not None
        assert len(a_entry['sens']) >= 2
        mots = [s['mot'] for s in a_entry['sens']]
        assert 'A' in mots

    def test_normalized_keys(self):
        data_dir = os.path.join(os.path.dirname(__file__), '..', 'public', 'data')
        index_path = os.path.join(data_dir, 'index.json')
        if not os.path.exists(index_path):
            pytest.skip('No index.json available')

        with open(index_path, 'r', encoding='utf-8') as f:
            index = json.load(f)

        for letter in index:
            if letter == '__version__':
                continue
            letter_file = os.path.join(data_dir, f'{letter}.json')
            if not os.path.exists(letter_file):
                continue

            with open(letter_file, 'r', encoding='utf-8') as f:
                data = json.load(f)

            for key in data:
                assert key == key.lower(), f'Key {key} is not lowercase'
                assert key == normalise(key), f'Key {key} is not normalized'

    def test_index_words_are_sorted(self):
        index_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', 'index.json')
        if not os.path.exists(index_path):
            pytest.skip('No index.json available')

        with open(index_path, 'r', encoding='utf-8') as f:
            index = json.load(f)

        for letter, words in index.items():
            if letter == '__version__':
                continue
            normalized = [normalise(w) for w in words]
            assert normalized == sorted(normalized), f'Words in {letter} are not sorted'
