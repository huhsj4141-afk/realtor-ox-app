import importlib.util, unittest, urllib.error, io, time
from unittest.mock import patch
from pathlib import Path
spec=importlib.util.spec_from_file_location('audit',Path(__file__).with_name('memory-audit.py'))
audit=importlib.util.module_from_spec(spec);spec.loader.exec_module(audit)
class AuditTests(unittest.TestCase):
    def test_malformed_model_output(self):
        by={'a':{'sources':[{'quote':'required source evidence'}]}}
        good={'id':'a','valid':True,'front':'question','back':'answer','evidence':'source evidence','cloze':None,'blank':None}
        self.assertTrue(audit.valid_item(good,by))
        for bad in [None,[],{**good,'id':[]},{**good,'valid':1},{**good,'back':[]},{**good,'cloze':{}},{**good,'evidence':'invented'}]:
            self.assertFalse(audit.valid_item(bad,by))
    def test_expired_deadline_does_not_call_network(self):
        with patch.object(audit.urllib.request,'urlopen') as url:
            with self.assertRaises(TimeoutError):audit.request('models',deadline=time.monotonic()-1)
            url.assert_not_called()
    def test_rate_limit_wait_cannot_exceed_deadline(self):
        error=urllib.error.HTTPError('https://example.invalid',429,'rate limit',{},io.BytesIO(b'{"retryDelay":"120s"}'))
        with patch.object(audit.urllib.request,'urlopen',side_effect=error),patch.object(audit.time,'sleep') as sleep:
            with self.assertRaises(TimeoutError):audit.request('models',deadline=time.monotonic()+10)
            sleep.assert_not_called()
if __name__=='__main__':unittest.main()
